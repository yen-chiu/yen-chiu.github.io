const dns = require('node:dns').promises
const fs = require('node:fs/promises')
const net = require('node:net')
const path = require('node:path')
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')

const { chromium } = require('playwright')

const execFileAsync = promisify(execFile)
const root = process.env.GITHUB_WORKSPACE || process.cwd()
const configPath = path.join(root, '.github/friend-link.config.json')
const PAGE_NAVIGATION_TIMEOUT_MS = 60_000
const BRANCH_HEAD_WAIT_TIMEOUT_MS = 60_000
const BRANCH_HEAD_WAIT_INTERVAL_MS = 2_000

const FIELD_ALIASES = {
  name: ['网站名称', '站点名称', '名称', '网站名称 / Site name', 'Site name'],
  url: ['网站链接', '站点链接', '链接', '网址', '网站链接 / Site URL', 'Site URL'],
  friendPage: [
    '友链页面 URL',
    '友链页面',
    '友链地址',
    '友链页面 URL / Friend-links page URL',
    'Friend-links page URL'
  ],
  description: [
    '网站描述',
    '站点描述',
    '描述',
    '简介',
    '网站描述 / Site description',
    'Site description'
  ],
  avatar: [
    '网站头像 URL',
    '网站头像',
    '头像 URL',
    '头像',
    '网站头像 URL / Site avatar URL',
    'Site avatar URL'
  ]
}

const LABEL_COLORS = {
  request: 'bfdadc',
  checking: 'fbca04',
  needsUpdate: 'd93f0b',
  review: '5319e7',
  approved: '0e8a16'
}

class FriendLinkError extends Error {
  constructor({ messageZh, messageEn, suggestionZh, suggestionEn }) {
    super(messageZh)
    this.name = 'FriendLinkError'
    this.messageZh = messageZh
    this.messageEn = messageEn
    this.suggestionZh = suggestionZh
    this.suggestionEn = suggestionEn
  }
}

function fail(details) {
  throw new FriendLinkError(details)
}

function parseIssueBody(body) {
  const sections = new Map()
  const pattern = /^###\s+(.+?)\s*\n+([\s\S]*?)(?=^###\s+|\s*$)/gm

  for (const match of body.matchAll(pattern)) {
    const value = match[2].trim()
    if (value && value !== '_No response_') sections.set(match[1].trim(), value)
  }

  const getField = (key) => {
    for (const alias of FIELD_ALIASES[key]) {
      const value = sections.get(alias)
      if (value) return value
    }
    return ''
  }

  return {
    name: getField('name'),
    url: getField('url'),
    friendPage: getField('friendPage'),
    description: getField('description'),
    avatar: getField('avatar')
  }
}

function normalizeHttpUrl(value) {
  try {
    const url = new URL(value.trim())
    if (!['http:', 'https:'].includes(url.protocol)) return ''
    url.hash = ''
    return url.toString()
  } catch {
    return ''
  }
}

function normalizeComparableUrl(value) {
  const url = new URL(value)
  return `${url.hostname.toLowerCase()}${url.pathname.replace(/\/+$/, '') || '/'}`
}

function isPrivateIp(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number)
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    )
  }

  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase()
    return (
      normalized === '::' ||
      normalized === '::1' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') ||
      normalized.startsWith('fea') ||
      normalized.startsWith('feb')
    )
  }

  return true
}

async function assertPublicUrl(value) {
  const url = new URL(value)
  const hostname = url.hostname.toLowerCase()
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    fail({
      messageZh: `地址 ${value} 使用了 localhost`,
      messageEn: `The URL ${value} uses localhost`,
      suggestionZh: '请填写公网可访问的 HTTP(S) 地址，不要使用 localhost。',
      suggestionEn: 'Please use a publicly accessible HTTP(S) URL instead of localhost.'
    })
  }

  let addresses
  try {
    addresses = net.isIP(hostname)
      ? [{ address: hostname }]
      : await dns.lookup(hostname, { all: true, verbatim: true })
  } catch {
    fail({
      messageZh: `地址 ${value} 的域名解析失败`,
      messageEn: `DNS lookup failed for ${value}`,
      suggestionZh: '请确认域名已经正确解析，且 GitHub Actions 所在网络可以访问。',
      suggestionEn:
        'Please make sure the domain resolves correctly and is reachable from GitHub Actions.'
    })
  }

  if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) {
    fail({
      messageZh: `地址 ${value} 解析到了私网、环回或保留 IP`,
      messageEn: `The URL ${value} resolves to a private, loopback, or reserved IP`,
      suggestionZh: '请填写公网域名，或检查域名解析是否误指向了内网/保留地址。',
      suggestionEn:
        'Please use a public domain, or check whether the DNS record points to a private or reserved address.'
    })
  }
}

async function validateFriendPage(pageUrl, site) {
  await assertPublicUrl(pageUrl)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent: 'VesperFriendLinkChecker/1.0',
    ignoreHTTPSErrors: false
  })
  const page = await context.newPage()
  let blockedNavigation = ''

  await page.route('**/*', async (route) => {
    const request = route.request()
    try {
      await assertPublicUrl(request.url())
      await route.continue()
    } catch {
      if (request.isNavigationRequest()) blockedNavigation = request.url()
      await route.abort('blockedbyclient')
    }
  })

  try {
    const response = await page.goto(pageUrl, {
      waitUntil: 'domcontentloaded',
      timeout: PAGE_NAVIGATION_TIMEOUT_MS
    })
    await page.waitForTimeout(2_000)

    if (blockedNavigation) {
      fail({
        messageZh: `友链页面跳转到了不允许访问的地址：${blockedNavigation}`,
        messageEn: `The friend-links page redirects to a blocked URL: ${blockedNavigation}`,
        suggestionZh: '请避免跳转到 localhost、内网地址或保留 IP。',
        suggestionEn: 'Please avoid redirects to localhost, private networks, or reserved IPs.'
      })
    }
    if (!response) {
      fail({
        messageZh: '友链页面没有返回有效响应',
        messageEn: 'The friend-links page did not return a valid response',
        suggestionZh: '请确认友链页面可以直接公开访问。',
        suggestionEn: 'Please make sure the friend-links page is publicly accessible.'
      })
    }
    if (response.status() >= 400) {
      fail({
        messageZh: `友链页面返回 HTTP ${response.status()}`,
        messageEn: `The friend-links page returned HTTP ${response.status()}`,
        suggestionZh: '请确认友链页面地址正确，且无需登录、验证码或特殊请求头。',
        suggestionEn:
          'Please make sure the page URL is correct and does not require login, CAPTCHA, or special request headers.'
      })
    }

    const finalUrl = page.url()
    await assertPublicUrl(finalUrl)

    const target = new URL(site.url)
    const targetHost = target.hostname.toLowerCase()
    const targetUrl = normalizeComparableUrl(site.url)
    const links = await page
      .locator('a[href]')
      .evaluateAll((elements) => elements.map((element) => element.href))
    const hasBacklink = links.some((href) => {
      try {
        const candidate = new URL(href)
        return (
          candidate.hostname.toLowerCase() === targetHost ||
          normalizeComparableUrl(candidate.toString()) === targetUrl
        )
      } catch {
        return false
      }
    })

    if (!hasBacklink) {
      fail({
        messageZh: `友链页面中没有找到指向 ${site.url} 的链接`,
        messageEn: `No backlink to ${site.url} was found on the friend-links page`,
        suggestionZh: '请先在你的友链页面添加本站链接，并确保链接 href 指向本站首页。',
        suggestionEn:
          'Please add this site to your friend-links page first, and make sure the link href points to this site homepage.'
      })
    }

    return finalUrl
  } catch (error) {
    if (error instanceof FriendLinkError) throw error
    if (error.name === 'TimeoutError' || /Timeout \d+ms exceeded/.test(error.message)) {
      fail({
        messageZh: `友链页面 ${pageUrl} 加载超时`,
        messageEn: `The friend-links page ${pageUrl} timed out while loading`,
        suggestionZh: `请优化页面加载速度，或确认 GitHub Actions 能在 ${PAGE_NAVIGATION_TIMEOUT_MS / 1000} 秒内打开该页面。`,
        suggestionEn: `Please optimize the page loading speed, or make sure GitHub Actions can open it within ${PAGE_NAVIGATION_TIMEOUT_MS / 1000} seconds.`
      })
    }
    fail({
      messageZh: `友链页面无法完成校验：${error.message}`,
      messageEn: `The friend-links page could not be validated: ${error.message}`,
      suggestionZh: '请确认友链页面可以被普通浏览器直接打开，并且没有防爬、地区限制或证书错误。',
      suggestionEn:
        'Please make sure the page opens directly in a normal browser and has no anti-bot rules, regional restrictions, or certificate errors.'
    })
  } finally {
    await browser.close()
  }
}

async function validateAvatarUrl(avatarUrl, site) {
  await assertPublicUrl(avatarUrl)

  const siteOrigin = new URL(site.friendPage || site.url)
  const checkUrl = new URL('/__friend-link-avatar-check__', siteOrigin)
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent: 'VesperFriendLinkChecker/1.0',
    ignoreHTTPSErrors: false
  })
  const page = await context.newPage()

  await page.route('**/*', async (route) => {
    const request = route.request()
    if (request.url() === checkUrl.toString()) {
      await route.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: `<!doctype html><img id="avatar" src="${avatarUrl.replace(/"/g, '&quot;')}">`
      })
      return
    }

    try {
      await assertPublicUrl(request.url())
      await route.continue()
    } catch {
      await route.abort('blockedbyclient')
    }
  })

  try {
    await page.goto(checkUrl.toString(), {
      waitUntil: 'domcontentloaded',
      timeout: PAGE_NAVIGATION_TIMEOUT_MS
    })

    const loaded = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const image = document.getElementById('avatar')
          if (!(image instanceof HTMLImageElement)) {
            resolve(false)
            return
          }
          if (image.complete) {
            resolve(image.naturalWidth > 0 && image.naturalHeight > 0)
            return
          }
          const timer = window.setTimeout(() => resolve(false), 10_000)
          image.addEventListener(
            'load',
            () => {
              window.clearTimeout(timer)
              resolve(image.naturalWidth > 0 && image.naturalHeight > 0)
            },
            { once: true }
          )
          image.addEventListener(
            'error',
            () => {
              window.clearTimeout(timer)
              resolve(false)
            },
            { once: true }
          )
        })
    )

    if (!loaded) {
      fail({
        messageZh: '头像地址无法作为第三方页面图片加载',
        messageEn: 'The avatar URL could not be loaded as a third-party image',
        suggestionZh: '请换成可公开直连的图片地址，避免防盗链、登录限制或仅网页预览地址。',
        suggestionEn:
          'Please use a direct, public image URL without hotlink protection, login restrictions, or page-preview-only URLs.'
      })
    }
  } catch (error) {
    if (error instanceof FriendLinkError) throw error
    fail({
      messageZh: `头像地址无法完成校验：${error.message}`,
      messageEn: `The avatar URL could not be validated: ${error.message}`,
      suggestionZh: '请确认头像 URL 是可公开访问的图片资源，并允许第三方页面直接加载。',
      suggestionEn:
        'Please make sure the avatar URL is a publicly accessible image resource and allows third-party page loading.'
    })
  } finally {
    await browser.close()
  }
}

async function ensureLabel(github, owner, repo, name, color) {
  try {
    await github.rest.issues.getLabel({ owner, repo, name })
  } catch (error) {
    if (error.status !== 404) throw error
    await github.rest.issues.createLabel({ owner, repo, name, color })
  }
}

async function setStatusLabels(github, owner, repo, issueNumber, config, status) {
  for (const [key, name] of Object.entries(config.labels)) {
    await ensureLabel(github, owner, repo, name, LABEL_COLORS[key] || 'ededed')
  }

  const remove = Object.entries(config.labels)
    .filter(([key]) => key !== 'request' && key !== status)
    .map(([, name]) => name)

  for (const name of remove) {
    try {
      await github.rest.issues.removeLabel({ owner, repo, issue_number: issueNumber, name })
    } catch (error) {
      if (error.status !== 404) throw error
    }
  }

  await github.rest.issues.addLabels({
    owner,
    repo,
    issue_number: issueNumber,
    labels: [config.labels.request, config.labels[status]]
  })
}

async function comment(github, owner, repo, issueNumber, body) {
  await github.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body
  })
}

async function hasWritePermission(github, owner, repo, username) {
  try {
    const { data } = await github.rest.repos.getCollaboratorPermissionLevel({
      owner,
      repo,
      username
    })
    return ['admin', 'maintain', 'write'].includes(data.permission)
  } catch {
    return false
  }
}

async function updateLinksFile(config, request, issueNumber) {
  const linksPath = path.join(root, config.linksFile)
  const raw = await fs.readFile(linksPath, 'utf8')
  const data = JSON.parse(raw)
  const group = data.friends?.find((item) => item.id_name === config.targetGroup)
  if (!group) throw new Error(`找不到友链分组 ${config.targetGroup}`)

  const normalizedUrl = normalizeComparableUrl(request.url)
  const duplicate = data.friends
    .flatMap((item) => item.link_list || [])
    .find((friend) => {
      try {
        return normalizeComparableUrl(friend.link) === normalizedUrl
      } catch {
        return false
      }
    })

  if (duplicate) return { duplicate }

  group.link_list.push({
    name: request.name,
    intro: request.description,
    link: request.url,
    avatar: request.avatar,
    issue_id: issueNumber
  })

  await fs.writeFile(linksPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  return { duplicate: null }
}

async function commitAndPush(request, issueNumber) {
  await execFileAsync('git', ['config', 'user.name', 'github-actions[bot]'], { cwd: root })
  await execFileAsync(
    'git',
    ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'],
    { cwd: root }
  )
  await execFileAsync('git', ['add', 'public/links.json'], { cwd: root })
  await execFileAsync(
    'git',
    ['commit', '-m', `chore(links): add ${request.name} (#${issueNumber})`],
    {
      cwd: root
    }
  )
  const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: root })
  await execFileAsync('git', ['push'], { cwd: root })
  return stdout.trim()
}

async function triggerPagesDeploy(github, owner, repo, config, ref) {
  await github.rest.actions.createWorkflowDispatch({
    owner,
    repo,
    workflow_id: config.deployWorkflow || 'deploy.yml',
    ref
  })
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForBranchHead(github, owner, repo, branch, expectedSha) {
  const deadline = Date.now() + BRANCH_HEAD_WAIT_TIMEOUT_MS

  while (Date.now() < deadline) {
    const { data } = await github.rest.repos.getBranch({
      owner,
      repo,
      branch
    })

    if (data.commit.sha === expectedSha) return true
    await sleep(BRANCH_HEAD_WAIT_INTERVAL_MS)
  }

  return false
}

module.exports = async ({ github, context, core }) => {
  const issue = context.payload.issue
  if (!issue) return

  const config = JSON.parse(await fs.readFile(configPath, 'utf8'))
  const { owner, repo } = context.repo
  const issueNumber = issue.number
  const request = parseIssueBody(issue.body || '')
  const commentBody = context.payload.comment?.body?.trim() || ''
  const commenter = context.payload.comment?.user?.login || ''
  const command = commentBody.match(/^\/(approve|force-approve|reject)\b(?:\s+([\s\S]*))?/i)
  const reviewCommand = command?.[1]?.toLowerCase() || ''
  const issueLabels = new Set((issue.labels || []).map((label) => label.name || label))

  if (!request.name || !request.url || !request.friendPage) {
    core.info('Issue does not match the friend-link form; skipping.')
    return
  }

  if (context.eventName === 'issue_comment') {
    if (command) {
      const canReview = await hasWritePermission(github, owner, repo, commenter)
      if (!canReview) {
        core.info('Review command ignored because the commenter has no write permission.')
        return
      }

      if (reviewCommand === 'reject') {
        const reason = command[2]?.trim() || '未提供具体原因'
        await setStatusLabels(github, owner, repo, issueNumber, config, 'needsUpdate')
        await comment(
          github,
          owner,
          repo,
          issueNumber,
          [
            `人工审核未通过：${reason}`,
            `Manual review rejected: ${reason}`,
            '',
            '申请者修正后可重新打开此 Issue，再次触发技术校验。',
            'After fixing the issue, reopen this Issue to run validation again.'
          ].join('\n')
        )
        await github.rest.issues.update({
          owner,
          repo,
          issue_number: issueNumber,
          state: 'closed',
          state_reason: 'not_planned'
        })
        return
      }
    } else if (commenter !== issue.user.login) {
      core.info('Only the issue author can trigger revalidation without a review command.')
      return
    } else if (!issueLabels.has(config.labels.needsUpdate)) {
      core.info('Issue author comments only trigger revalidation while needs-update is set.')
      return
    }
  }

  await setStatusLabels(github, owner, repo, issueNumber, config, 'checking')

  try {
    for (const [label, value] of [
      ['网站链接', request.url],
      ['友链页面 URL', request.friendPage],
      ['网站头像 URL', request.avatar]
    ]) {
      const normalized = normalizeHttpUrl(value)
      if (!normalized) {
        fail({
          messageZh: `${label}不是有效的 HTTP(S) 地址`,
          messageEn: `${label} is not a valid HTTP(S) URL`,
          suggestionZh: '请填写完整的 http:// 或 https:// URL。',
          suggestionEn: 'Please enter a complete http:// or https:// URL.'
        })
      }
      if (label === '网站链接') request.url = normalized
      if (label === '友链页面 URL') request.friendPage = normalized
      if (label === '网站头像 URL') request.avatar = normalized
    }

    if (request.name.length > 80 || request.description.length > 200) {
      fail({
        messageZh: '网站名称或描述过长',
        messageEn: 'The site name or description is too long',
        suggestionZh: '请将网站名称控制在 80 字以内，描述控制在 200 字以内。',
        suggestionEn:
          'Please keep the site name within 80 characters and the description within 200 characters.'
      })
    }

    await assertPublicUrl(request.url)
    const isApproval = reviewCommand === 'approve'
    const isForceApproval = reviewCommand === 'force-approve'
    let finalFriendPage = request.friendPage

    if (!isForceApproval) {
      await validateAvatarUrl(request.avatar, config.site)
      finalFriendPage = await validateFriendPage(request.friendPage, config.site)
    } else {
      core.warning(`Friend link #${issueNumber} is being force-approved by ${commenter}.`)
    }

    if (!isApproval && !isForceApproval) {
      await setStatusLabels(github, owner, repo, issueNumber, config, 'review')
      await comment(
        github,
        owner,
        repo,
        issueNumber,
        [
          '自动技术校验通过，正在等待维护者人工审核站点内容。',
          'Automated validation passed. The site is awaiting manual review.',
          '',
          `申请者友链页面 / Applicant friend-links page: ${finalFriendPage}`,
          '',
          '维护者可评论 / Maintainer commands:',
          '- `/approve`：重新校验并添加友链 / Revalidate and add the friend link',
          '- `/force-approve`：跳过联网校验并强制添加友链 / Skip network validation and add the friend link',
          '- `/reject 原因`：拒绝申请并说明原因 / Reject with a reason'
        ].join('\n')
      )
      return
    }

    const { duplicate } = await updateLinksFile(config, request, issueNumber)
    if (duplicate) {
      await setStatusLabels(github, owner, repo, issueNumber, config, 'approved')
      await comment(
        github,
        owner,
        repo,
        issueNumber,
        [
          `该站点已存在于友链列表中：${duplicate.name} (${duplicate.link})。`,
          `This site is already in the friend-links list: ${duplicate.name} (${duplicate.link}).`,
          '',
          `本站友链页面 / Vesper friend-links page: ${config.site.friendPage}`
        ].join('\n')
      )
      await github.rest.issues.update({ owner, repo, issue_number: issueNumber, state: 'closed' })
      return
    }

    const pushedSha = await commitAndPush(request, issueNumber)
    const defaultBranch = context.payload.repository.default_branch
    let deployTriggered = true
    try {
      const branchReady = await waitForBranchHead(github, owner, repo, defaultBranch, pushedSha)
      if (!branchReady) {
        core.warning(
          `Default branch ${defaultBranch} did not resolve to ${pushedSha} before dispatch timeout.`
        )
      }
      await triggerPagesDeploy(github, owner, repo, config, defaultBranch)
    } catch (error) {
      deployTriggered = false
      core.warning(`Friend link was committed, but Pages dispatch failed: ${error.message}`)
    }
    await setStatusLabels(github, owner, repo, issueNumber, config, 'approved')
    await comment(
      github,
      owner,
      repo,
      issueNumber,
      [
        isForceApproval
          ? `维护者已强制通过，已添加友链 **${request.name}**。`
          : `自动校验通过，已添加友链 **${request.name}**。`,
        isForceApproval
          ? `A maintainer force-approved and added **${request.name}**.`
          : `Automated validation passed and **${request.name}** has been added.`,
        '',
        `申请者友链页面 / Applicant friend-links page: ${finalFriendPage}`,
        `本站友链页面 / Vesper friend-links page: ${config.site.friendPage}`,
        '',
        deployTriggered
          ? '已触发 GitHub Pages 构建。/ The GitHub Pages build has been triggered.'
          : '友链已写入，但 Pages 构建触发失败，请维护者手动运行部署工作流。/ The friend link was committed, but the Pages workflow must be started manually.'
      ].join('\n')
    )
    await github.rest.issues.update({ owner, repo, issue_number: issueNumber, state: 'closed' })
  } catch (error) {
    core.warning(error)
    const isFriendLinkError = error instanceof FriendLinkError
    const messageZh = isFriendLinkError ? error.messageZh : error.message
    const messageEn = isFriendLinkError ? error.messageEn : error.message
    const suggestionZh = isFriendLinkError ? error.suggestionZh : ''
    const suggestionEn = isFriendLinkError ? error.suggestionEn : ''
    await setStatusLabels(github, owner, repo, issueNumber, config, 'needsUpdate')
    await comment(
      github,
      owner,
      repo,
      issueNumber,
      [
        `自动校验未通过：${messageZh}`,
        `Automated validation failed: ${messageEn}`,
        ...(suggestionZh && suggestionEn
          ? ['', `建议处理：${suggestionZh}`, `Suggested fix: ${suggestionEn}`]
          : []),
        '',
        '请修正后由 Issue 作者回复任意内容，机器人会重新校验。',
        'After fixing the issue, the Issue author can reply to trigger validation again.',
        '',
        '本站友链信息 / Vesper friend-link information:',
        `- 名称 / Name: ${config.site.name}`,
        `- 链接 / URL: ${config.site.url}`,
        `- 友链页面 / Friend-links page: ${config.site.friendPage}`,
        `- 头像 / Avatar: ${config.site.avatar}`,
        `- 描述 / Description: ${config.site.description}`
      ].join('\n')
    )
    core.setFailed(error.message)
  }
}
