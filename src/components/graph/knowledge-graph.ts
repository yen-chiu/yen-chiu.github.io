import { graphLabel } from '@/utils/graph-label'
import { sitePath } from '@/utils/site-path'
import * as d3 from 'd3'

type Collection = 'blog' | 'docs'
type NodeKind = Collection | 'tag' | 'category'
type EdgeKind = 'citation' | 'tag' | 'category' | 'co-tag'
type Scope = 'all' | Collection | 'tags' | 'categories'
type Direction = 'mixed' | 'directed' | 'undirected'
type Layout = 'force' | 'radial'
type Flow = 'all' | 'incoming' | 'outgoing'

interface ContentDetails {
  slug: string
  aliases: string[]
  title: string
  tags: string[]
  categories: string[]
  links: string[]
  collection: Collection
  publishDate?: string
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string
  label: string
  href: string
  kind: NodeKind
  degree: number
  inDegree: number
  outDegree: number
  radius: number
}

interface GraphEdge extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode
  target: string | GraphNode
  kind: EdgeKind
  directed: boolean
  weight: number
}

interface GraphState {
  scope: Scope
  nodeTypes: Set<NodeKind>
  edgeTypes: Set<EdgeKind>
  direction: Direction
  layout: Layout
  focus: string | null
  depth: number
  flow: Flow
  isolated: boolean
}

type ContentIndex = Record<string, ContentDetails>

const initialized = new WeakSet<HTMLElement>()
const colors: Record<NodeKind, string> = {
  blog: '#8b5cf6',
  docs: '#0ea5e9',
  tag: '#f59e0b',
  category: '#10b981'
}
let indexPromise: Promise<ContentIndex> | null = null

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      (
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#039;'
        }) as Record<string, string>
      )[character]
  )
}

function loadIndex() {
  indexPromise ??= fetch(sitePath('/contentIndex.json')).then((response) => {
    if (!response.ok) throw new Error('Failed to load content index')
    return response.json() as Promise<ContentIndex>
  })
  return indexPromise
}

function normalizeSlug(index: ContentIndex, value: string) {
  let slug = value.replace(/^\//, '').replace(/\/$/, '').split('#')[0]
  if (!slug.startsWith('blog/') && !slug.startsWith('docs/') && !slug.includes('/')) {
    slug = `blog/${slug}`
  }
  if (index[slug]) return slug
  return Object.values(index).find(({ aliases }) => aliases.includes(slug))?.slug ?? slug
}

function readState(search = ''): GraphState {
  const params = new URLSearchParams(search)
  const scope = params.get('scope') as Scope | null
  const direction = params.get('direction') as Direction | null
  const layout = params.get('layout') as Layout | null
  const types = params.get('types')?.split(',') as NodeKind[] | undefined
  const relations = params.get('relations')?.split(',') as EdgeKind[] | undefined

  return {
    scope: ['all', 'blog', 'docs', 'tags', 'categories'].includes(scope ?? '') ? scope! : 'all',
    nodeTypes: new Set(types?.length ? types : ['blog', 'docs', 'tag', 'category']),
    edgeTypes: new Set(relations?.length ? relations : ['citation', 'tag', 'category', 'co-tag']),
    direction: ['mixed', 'directed', 'undirected'].includes(direction ?? '') ? direction! : 'mixed',
    layout: layout === 'radial' ? 'radial' : 'force',
    focus: params.get('focus'),
    depth: Math.min(3, Math.max(0, Number(params.get('depth')) || 0)),
    flow: ['incoming', 'outgoing'].includes(params.get('flow') ?? '')
      ? (params.get('flow') as Flow)
      : 'all',
    isolated: params.get('isolated') === 'true'
  }
}

function writeState(root: HTMLElement, state: GraphState) {
  const params = new URLSearchParams()
  if (state.scope !== 'all') params.set('scope', state.scope)
  params.set('types', [...state.nodeTypes].join(','))
  params.set('relations', [...state.edgeTypes].join(','))
  if (state.direction !== 'mixed') params.set('direction', state.direction)
  if (state.layout !== 'force') params.set('layout', state.layout)
  if (state.focus) params.set('focus', state.focus)
  if (state.depth) params.set('depth', String(state.depth))
  if (state.flow !== 'all') params.set('flow', state.flow)
  if (state.isolated) params.set('isolated', 'true')
  const dialog = root.closest<HTMLDialogElement>('[data-knowledge-graph-dialog]')
  if (dialog) dialog.dataset.graphParams = `?${params}`
}

function buildGraph(index: ContentIndex, state: GraphState) {
  const nodes = new Map<string, GraphNode>()
  const edges = new Map<string, GraphEdge>()
  const entries = Object.entries(index).filter(([, details]) => {
    if (state.scope === 'blog' || state.scope === 'docs') return details.collection === state.scope
    return true
  })

  const addNode = (id: string, label: string, href: string, kind: NodeKind) => {
    if (!state.nodeTypes.has(kind) || nodes.has(id)) return
    nodes.set(id, { id, label, href: sitePath(href), kind, degree: 0, inDegree: 0, outDegree: 0, radius: 7 })
  }
  const addEdge = (
    source: string,
    target: string,
    kind: EdgeKind,
    directed: boolean,
    weight = 1
  ) => {
    if (!state.edgeTypes.has(kind) || source === target || !nodes.has(source) || !nodes.has(target))
      return
    const ordered = directed ? `${source}->${target}` : [source, target].sort().join('<->')
    const key = `${kind}:${ordered}`
    const existing = edges.get(key)
    if (existing) existing.weight += weight
    else edges.set(key, { source, target, kind, directed, weight })
  }

  if (state.scope === 'tags') {
    entries.forEach(([, details]) => {
      details.tags.forEach((tag) =>
        addNode(`tag:${tag}`, `#${tag}`, `/tags/${encodeURIComponent(tag)}`, 'tag')
      )
      for (let i = 0; i < details.tags.length; i += 1) {
        for (let j = i + 1; j < details.tags.length; j += 1) {
          addEdge(`tag:${details.tags[i]}`, `tag:${details.tags[j]}`, 'co-tag', false)
        }
      }
    })
  } else if (state.scope === 'categories') {
    entries.forEach(([, details]) => {
      details.categories.forEach((category) => {
        addNode(
          `category:${category}`,
          category.split('/').at(-1) || category,
          `/categories/${category}`,
          'category'
        )
        const parent = category.split('/').slice(0, -1).join('/')
        if (parent) {
          addNode(
            `category:${parent}`,
            parent.split('/').at(-1) || parent,
            `/categories/${parent}`,
            'category'
          )
          addEdge(`category:${parent}`, `category:${category}`, 'category', true)
        }
      })
    })
  } else {
    entries.forEach(([slug, details]) => {
      addNode(slug, details.title, `/${slug}`, details.collection)
      details.tags.forEach((tag) =>
        addNode(`tag:${tag}`, `#${tag}`, `/tags/${encodeURIComponent(tag)}`, 'tag')
      )
      details.categories.forEach((category) =>
        addNode(
          `category:${category}`,
          category.split('/').at(-1) || category,
          `/categories/${category}`,
          'category'
        )
      )
    })

    entries.forEach(([slug, details]) => {
      details.links.forEach((rawTarget) => {
        const target = normalizeSlug(index, rawTarget)
        addEdge(slug, target, 'citation', true)
      })
      details.tags.forEach((tag) => addEdge(slug, `tag:${tag}`, 'tag', false))
      details.categories.forEach((category) =>
        addEdge(slug, `category:${category}`, 'category', false)
      )
      for (let i = 0; i < details.tags.length; i += 1) {
        for (let j = i + 1; j < details.tags.length; j += 1) {
          addEdge(`tag:${details.tags[i]}`, `tag:${details.tags[j]}`, 'co-tag', false)
        }
      }
    })
  }

  let graphNodes = [...nodes.values()]
  let graphEdges = [...edges.values()]

  if (state.focus && state.flow !== 'all') {
    const citationEdges = graphEdges.filter((edge) => {
      if (edge.kind !== 'citation') return false
      const source = String(edge.source)
      const target = String(edge.target)
      return state.flow === 'incoming' ? target === state.focus : source === state.focus
    })
    const relevant = new Set([state.focus])
    citationEdges.forEach((edge) => {
      relevant.add(String(edge.source))
      relevant.add(String(edge.target))
    })
    graphEdges = graphEdges.filter((edge) => {
      if (edge.kind === 'citation') return citationEdges.includes(edge)
      return relevant.has(String(edge.source)) || relevant.has(String(edge.target))
    })
    graphEdges.forEach((edge) => {
      relevant.add(String(edge.source))
      relevant.add(String(edge.target))
    })
    graphNodes = graphNodes.filter((node) => relevant.has(node.id))
  }

  if (state.focus && state.depth > 0 && nodes.has(state.focus)) {
    const adjacency = new Map<string, Set<string>>()
    graphEdges.forEach((edge) => {
      const source = String(edge.source)
      const target = String(edge.target)
      if (!adjacency.has(source)) adjacency.set(source, new Set())
      if (!adjacency.has(target)) adjacency.set(target, new Set())
      adjacency.get(source)?.add(target)
      adjacency.get(target)?.add(source)
    })
    const visible = new Set([state.focus])
    let frontier = new Set([state.focus])
    for (let level = 0; level < state.depth; level += 1) {
      const next = new Set<string>()
      frontier.forEach((id) => {
        adjacency.get(id)?.forEach((neighbour) => {
          if (!visible.has(neighbour)) next.add(neighbour)
          visible.add(neighbour)
        })
      })
      frontier = next
    }
    graphNodes = graphNodes.filter((node) => visible.has(node.id))
    graphEdges = graphEdges.filter(
      (edge) => visible.has(String(edge.source)) && visible.has(String(edge.target))
    )
  }

  if (state.isolated) {
    const connected = new Set<string>()
    graphEdges.forEach((edge) => {
      connected.add(String(edge.source))
      connected.add(String(edge.target))
    })
    graphNodes = graphNodes.filter((node) => !connected.has(node.id))
    graphEdges = []
  }

  graphEdges.forEach((edge) => {
    const source = nodes.get(String(edge.source))
    const target = nodes.get(String(edge.target))
    if (!source || !target) return
    source.degree += 1
    target.degree += 1
    source.outDegree += 1
    target.inDegree += 1
  })
  graphNodes.forEach((node) => {
    node.radius = Math.min(16, 6 + Math.sqrt(node.degree) * 2)
  })

  return { nodes: graphNodes, edges: graphEdges }
}

function setupRoot(root: HTMLElement, index: ContentIndex) {
  const dialog = root.closest<HTMLDialogElement>('[data-knowledge-graph-dialog]')
  let state = readState(dialog?.dataset.graphParams)
  let simulation: d3.Simulation<GraphNode, GraphEdge> | null = null
  let zoomToNode: ((id: string) => void) | null = null
  let resizeCanvas:(()=>void)|null=null
  let renderPending=false
  let lastSize=''
  let resizeFrame=0
  const canvas = root.querySelector<HTMLElement>('[data-graph-canvas]')
  const status = root.querySelector<HTMLElement>('[data-graph-status]')
  const stats = root.querySelector<HTMLElement>('[data-graph-stats]')
  const title = root.querySelector<HTMLElement>('[data-graph-title]')
  const details = root.querySelector<HTMLElement>('[data-graph-details]')
  const search = root.querySelector<HTMLInputElement>('[data-graph-search]')
  const suggestions = root.querySelector<HTMLElement>('[data-graph-suggestions]')
  const direction = root.querySelector<HTMLSelectElement>('[data-graph-direction]')
  const layout = root.querySelector<HTMLSelectElement>('[data-graph-layout]')
  const depth = root.querySelector<HTMLSelectElement>('[data-graph-depth]')
  const flow = root.querySelector<HTMLSelectElement>('[data-graph-flow]')
  const isolated = root.querySelector<HTMLInputElement>('[data-graph-isolated]')
  if (
    !canvas ||
    !stats ||
    !title ||
    !details ||
    !search ||
    !suggestions ||
    !direction ||
    !layout ||
    !depth ||
    !flow ||
    !isolated
  )
    return

  const syncControls = () => {
    root.querySelectorAll<HTMLButtonElement>('[data-graph-scope] button').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.value === state.scope)
    })
    root.querySelectorAll<HTMLInputElement>('[data-node-type]').forEach((input) => {
      input.checked = state.nodeTypes.has(input.value as NodeKind)
    })
    root.querySelectorAll<HTMLInputElement>('[data-edge-type]').forEach((input) => {
      input.checked = state.edgeTypes.has(input.value as EdgeKind)
    })
    direction.value = state.direction
    layout.value = state.layout
    depth.value = String(state.depth)
    flow.value = state.flow
    isolated.checked = state.isolated
  }

  const showDetails = (node: GraphNode, edges: GraphEdge[]) => {
    const incoming = edges.filter(
      (edge) => (typeof edge.target==='string'?edge.target:edge.target.id) === node.id
    ).length
    const outgoing = edges.filter(
      (edge) => (typeof edge.source==='string'?edge.source:edge.source.id) === node.id
    ).length
    root.classList.add('has-selection')
    const signature=JSON.stringify([node.id,node.label,node.degree,incoming,outgoing])
    if(details.dataset.signature===signature)return
    details.dataset.signature=signature
    const kind=node.kind==='blog'?'文章':node.kind==='docs'?'文档':node.kind==='tag'?'标签':'分类'
    details.innerHTML = `
      <div class="graph-selection-main"><div class="graph-selection-copy">
        <span class="graph-node-kind">${kind}</span>
        <h3 title="${escapeHtml(node.label)}">${escapeHtml(node.label)}</h3>
      </div><a class="graph-node-open" href="${escapeHtml(node.href)}" aria-label="打开：${escapeHtml(node.label)}" data-astro-prefetch>打开 ↗</a></div>
      <details class="graph-node-more"><summary>连接详情 · ${node.degree} 条</summary>
        <p class="graph-full-label">${escapeHtml(node.label)}</p>
        <dl><div><dt>连接</dt><dd>${node.degree}</dd></div><div><dt>入 / 出</dt><dd>${incoming} / ${outgoing}</dd></div></dl>
      </details>
    `
  }

  const render = () => {
    if(canvas.clientWidth<1||canvas.clientHeight<1){renderPending=true;return}
    renderPending=false;lastSize=`${canvas.clientWidth}x${canvas.clientHeight}`
    simulation?.stop()
    d3.select(canvas).selectAll('*').remove()
    const graph = buildGraph(index, state)
    root.classList.remove('is-loading')
    root.classList.toggle('is-empty',!graph.nodes.length)
    const width = canvas.clientWidth || 760
    const height = canvas.clientHeight || 580
    const selected=graph.nodes.find(node=>node.id===state.focus)
    if(selected)showDetails(selected,graph.edges)
    else{root.classList.remove('has-selection');details.replaceChildren();delete details.dataset.signature}
    const mobile = window.matchMedia('(max-width: 639px)').matches
    const directed = (edge: GraphEdge) =>
      state.direction === 'directed' || (state.direction === 'mixed' && edge.directed)
    const scopeLabels: Record<Scope, string> = {
      all: '全部知识',
      blog: '文章关系',
      docs: '文档关系',
      tags: '标签共现',
      categories: '分类结构'
    }
    title.textContent = scopeLabels[state.scope]
    stats.textContent = `${graph.nodes.length} 节点 · ${graph.edges.length} 关系`
    status?.remove()

    if (!graph.nodes.length) {
      canvas.innerHTML = '<p>当前筛选条件下没有节点。</p>'
      return
    }

    const svg = d3
      .select(canvas)
      .append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', '交互式知识图谱')
    const defs = svg.append('defs')
    defs
      .append('marker')
      .attr('id', 'knowledge-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 18)
      .attr('markerWidth', 5)
      .attr('markerHeight', 5)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', 'hsl(var(--primary) / 0.55)')

    const viewport = svg.append('g')
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.25, 4])
      .on('zoom', (event) => viewport.attr('transform', event.transform))
    svg.call(zoom)

    const links = viewport
      .append('g')
      .selectAll<SVGLineElement, GraphEdge>('line')
      .data(graph.edges)
      .join('line')
      .attr('stroke', (edge) =>
        edge.kind === 'citation'
          ? 'hsl(var(--primary) / 0.48)'
          : 'hsl(var(--muted-foreground) / 0.22)'
      )
      .attr('stroke-width', (edge) => Math.min(3, 0.7 + edge.weight * 0.35))
      .attr('stroke-dasharray', (edge) => (edge.kind === 'citation' ? null : '3 3'))
      .attr('marker-end', (edge) => (directed(edge) ? 'url(#knowledge-arrow)' : null))

    const node = viewport
      .append('g')
      .selectAll<SVGGElement, GraphNode>('g')
      .data(graph.nodes)
      .join('g')
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-label', item => item.label)
      .attr('aria-pressed', item => String(item.id === state.focus))
      .style('cursor', 'pointer')

    node.append('title').text(item => item.label)
    node.append('circle').attr('r', item => Math.max(item.radius, mobile ? 22 : 14)).attr('fill', 'transparent')
    node
      .append('circle')
      .attr('r', (item) => item.radius)
      .attr('fill', (item) => `${colors[item.kind]}28`)
      .attr('stroke', (item) => colors[item.kind])
      .attr('stroke-width', (item) => (item.id === state.focus ? 3 : 1.5))

    const labels = node
      .append('text')
      .attr('x', (item) => item.radius + 4)
      .attr('y', 3)
      .attr('fill', 'hsl(var(--foreground))')
      .attr('font-size', mobile ? 13 : 11)
      .attr('font-weight', (item) => (item.id === state.focus ? 700 : 480))
      .text((item) => graphLabel(item.label, item.kind, mobile, item.id === state.focus))

    const neighbours = new Map<string, Set<string>>()
    graph.edges.forEach((edge) => {
      const source = String(edge.source)
      const target = String(edge.target)
      if (!neighbours.has(source)) neighbours.set(source, new Set())
      if (!neighbours.has(target)) neighbours.set(target, new Set())
      neighbours.get(source)?.add(target)
      neighbours.get(target)?.add(source)
    })
    const focus = (item: GraphNode | null) => {
      const connected = item ? neighbours.get(item.id) : null
      labels.text(candidate => graphLabel(candidate.label, candidate.kind, mobile, candidate.id === item?.id || candidate.id === state.focus))
      node.attr('opacity', (candidate) =>
        !item || candidate.id === item.id || connected?.has(candidate.id) ? 1 : 0.12
      )
      links.attr('opacity', (edge) => {
        if (!item) return 1
        const source = (edge.source as GraphNode).id
        const target = (edge.target as GraphNode).id
        return source === item.id || target === item.id ? 1 : 0.06
      })
    }
    const selectNode = (item: GraphNode) => {
      state.focus = item.id
      writeState(root, state)
      if (state.depth > 0 || state.flow !== 'all') render()
      showDetails(item, graph.edges)
      node.attr('aria-pressed', candidate => String(candidate.id === item.id))
      labels.text(candidate => graphLabel(candidate.label, candidate.kind, mobile, candidate.id === item.id))
    }
    node
      .on('mouseenter', (_event, item) => focus(item))
      .on('mouseleave', () => focus(null))
      .on('click', (_event, item) => selectNode(item))
      .on('keydown', (event, item) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        selectNode(item)
      })
      .on('dblclick', (_event, item) => {
        location.href = item.href
      })

    simulation = d3
      .forceSimulation<GraphNode>(graph.nodes)
      .alphaDecay(0.055)
      .velocityDecay(0.48)
      .force(
        'link',
        d3
          .forceLink<GraphNode, GraphEdge>(graph.edges)
          .id((item) => item.id)
          .distance((edge) => (edge.kind === 'citation' ? 82 : 58))
          .strength(0.38)
      )
      .force('charge', d3.forceManyBody().strength(-115))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('x', d3.forceX(width / 2).strength(0.03))
      .force('y', d3.forceY(height / 2).strength(0.03))
      .force(
        'collide',
        d3.forceCollide<GraphNode>().radius((item) => item.radius + 12)
      )
      .force(
        'radial',
        state.layout === 'radial'
          ? d3
              .forceRadial<GraphNode>(
                (item) => {
                  const order: Record<NodeKind, number> = {
                    blog: 0.28,
                    docs: 0.28,
                    tag: 0.5,
                    category: 0.7
                  }
                  return Math.min(width, height) * order[item.kind]
                },
                width / 2,
                height / 2
              )
              .strength(0.55)
          : null
      )
      .on('tick', () => {
        links
          .attr('x1', (edge) => (edge.source as GraphNode).x ?? 0)
          .attr('y1', (edge) => (edge.source as GraphNode).y ?? 0)
          .attr('x2', (edge) => (edge.target as GraphNode).x ?? 0)
          .attr('y2', (edge) => (edge.target as GraphNode).y ?? 0)
        node.attr('transform', (item) => `translate(${item.x ?? 0},${item.y ?? 0})`)
      })

    resizeCanvas=()=>{
      const nextWidth=canvas.clientWidth,nextHeight=canvas.clientHeight
      if(!nextWidth||!nextHeight)return
      lastSize=`${nextWidth}x${nextHeight}`
      svg.attr('viewBox',`0 0 ${nextWidth} ${nextHeight}`)
      ;(simulation?.force('center') as d3.ForceCenter<GraphNode>)?.x(nextWidth/2).y(nextHeight/2)
      ;(simulation?.force('x') as d3.ForceX<GraphNode>)?.x(nextWidth/2)
      ;(simulation?.force('y') as d3.ForceY<GraphNode>)?.y(nextHeight/2)
      const radial=simulation?.force('radial') as d3.ForceRadial<GraphNode>|undefined
      radial?.x(nextWidth/2).y(nextHeight/2).radius(item=>Math.min(nextWidth,nextHeight)*({blog:.28,docs:.28,tag:.5,category:.7}[item.kind]))
      simulation?.alpha(.2).restart()
    }

    node.call(
      d3
        .drag<SVGGElement, GraphNode>()
        .clickDistance(6)
        .on('start', (event, item) => {
          if (!event.active) simulation?.alphaTarget(0.18).restart()
          item.fx = item.x
          item.fy = item.y
        })
        .on('drag', (event, item) => {
          item.fx = event.x
          item.fy = event.y
        })
        .on('end', (event, item) => {
          if (!event.active) simulation?.alphaTarget(0)
          item.fx = null
          item.fy = null
        })
    )

    zoomToNode = (id) => {
      const target = graph.nodes.find((item) => item.id === id)
      if (!target) return
      showDetails(target, graph.edges)
      state.focus = target.id
      writeState(root, state)
      node.attr('aria-pressed', item => String(item.id === target.id))
      svg
        .transition()
        .duration(450)
        .call(
          zoom.transform,
          d3.zoomIdentity
            .translate(width / 2, height / 2)
            .scale(1.65)
            .translate(-(target.x ?? width / 2), -(target.y ?? height / 2))
        )
      labels.attr('font-weight', (item) => (item.id === target.id ? 700 : 480))
    }
    if (state.focus) window.setTimeout(() => zoomToNode?.(state.focus!), 350)

    root.querySelector<HTMLButtonElement>('[data-graph-zoom-in]')!.onclick = (event) => { event.stopPropagation(); svg.interrupt().call(zoom.scaleBy, 1.3) }
    root.querySelector<HTMLButtonElement>('[data-graph-zoom-out]')!.onclick = (event) => { event.stopPropagation(); svg.interrupt().call(zoom.scaleBy, 1 / 1.3) }
    root.querySelector<HTMLButtonElement>('[data-graph-fit]')!.onclick = (event) => { event.stopPropagation(); svg.interrupt().call(zoom.transform, d3.zoomIdentity) }

  }

  root.querySelectorAll<HTMLButtonElement>('[data-graph-scope] button').forEach((button) => {
    button.addEventListener('click', () => {
      state.scope = button.dataset.value as Scope
      if (state.scope === 'tags') state.nodeTypes = new Set(['tag'])
      else if (state.scope === 'categories') state.nodeTypes = new Set(['category'])
      else if (state.scope === 'blog') state.nodeTypes = new Set(['blog', 'tag', 'category'])
      else if (state.scope === 'docs') state.nodeTypes = new Set(['docs', 'tag'])
      else state.nodeTypes = new Set(['blog', 'docs', 'tag', 'category'])
      state.focus = null
      syncControls()
      writeState(root, state)
      render()
    })
  })
  root.querySelectorAll<HTMLInputElement>('[data-node-type]').forEach((input) => {
    input.addEventListener('change', () => {
      input.checked
        ? state.nodeTypes.add(input.value as NodeKind)
        : state.nodeTypes.delete(input.value as NodeKind)
      writeState(root, state)
      render()
    })
  })
  root.querySelectorAll<HTMLInputElement>('[data-edge-type]').forEach((input) => {
    input.addEventListener('change', () => {
      input.checked
        ? state.edgeTypes.add(input.value as EdgeKind)
        : state.edgeTypes.delete(input.value as EdgeKind)
      writeState(root, state)
      render()
    })
  })
  direction.addEventListener('change', () => {
    state.direction = direction.value as Direction
    writeState(root, state)
    render()
  })
  layout.addEventListener('change', () => {
    state.layout = layout.value as Layout
    writeState(root, state)
    render()
  })
  depth.addEventListener('change', () => {
    state.depth = Number(depth.value)
    writeState(root, state)
    render()
  })
  flow.addEventListener('change', () => {
    state.flow = flow.value as Flow
    writeState(root, state)
    render()
  })
  isolated.addEventListener('change', () => {
    state.isolated = isolated.checked
    writeState(root, state)
    render()
  })
  root.querySelector<HTMLButtonElement>('[data-graph-clear]')?.addEventListener('click', () => {
    state = readState()
    search.value='';suggestions.hidden=true;suggestions.replaceChildren()
    syncControls()
    writeState(root, state)
    render()
  })

  search.addEventListener('input', () => {
    const query = search.value.trim().toLocaleLowerCase()
    suggestions.replaceChildren()
    if (!query) {
      suggestions.hidden = true
      return
    }
    const matches = buildGraph(index, state)
      .nodes.filter((node) => node.label.toLocaleLowerCase().includes(query))
      .slice(0, 8)
    matches.forEach((node) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.dataset.suggestion = ''
      button.textContent = node.label
      button.addEventListener('click', () => {
        search.value = node.label
        suggestions.hidden = true
        if(dialog?.classList.contains('graph-settings-expanded')){
          state.focus=node.id;writeState(root,state)
          dialog.classList.remove('graph-settings-expanded')
          const button=dialog.querySelector<HTMLButtonElement>('[data-graph-settings]')
          button?.setAttribute('aria-expanded','false');if(button)button.textContent='筛选'
          requestAnimationFrame(render)
        }else zoomToNode?.(node.id)
      })
      suggestions.append(button)
    })
    suggestions.hidden = !matches.length
  })

  syncControls()
  render()
  const resizeObserver=new ResizeObserver(()=>{
    if(canvas.clientWidth<1||canvas.clientHeight<1){simulation?.stop();return}
    if(renderPending||lastSize!==`${canvas.clientWidth}x${canvas.clientHeight}`){
      cancelAnimationFrame(resizeFrame)
      resizeFrame=requestAnimationFrame(()=>{if(renderPending)render();else resizeCanvas?.()})
    }else simulation?.restart()
  })
  resizeObserver.observe(canvas)

  return (search?: string) => {
    if (!search) return
    state = readState(search)
    syncControls()
    render()
  }
}

const controllers = new WeakMap<HTMLElement, (search?: string) => void>()

export async function openKnowledgeGraph(dialog: HTMLDialogElement, search?: string) {
  const root = dialog.querySelector<HTMLElement>('[data-knowledge-graph]')
  if (!root) return
  const existing = controllers.get(root)
  if (existing) {
    existing(search)
    return
  }
  if (initialized.has(root)) return
  initialized.add(root)

  try {
    const index = await loadIndex()
    if (!root.isConnected) return
    const controller = setupRoot(root, index)
    if (controller) controllers.set(root, controller)
  } catch (error) {
    initialized.delete(root)
    console.error('Failed to initialize knowledge graph:', error)
    const status = root.querySelector<HTMLElement>('[data-graph-status]')
    if (status) status.textContent = '知识图谱加载失败，请刷新重试。'
  }
}
