import type * as D3 from 'd3'

interface TagNodeData {
  name: string
  count: number
}

interface TagLinkData {
  source: string
  target: string
  count: number
}

interface GraphData {
  nodes: TagNodeData[]
  links: TagLinkData[]
}

interface GraphNode extends D3.SimulationNodeDatum {
  id: string
  label: string
  count: number
  radius: number
}

interface GraphLink extends D3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode
  target: string | GraphNode
  count: number
}

const initialized = new WeakSet<HTMLElement>()

async function renderGlobalTagGraph(root: HTMLElement, data: GraphData) {
  const canvas = root.querySelector<HTMLElement>('[data-global-tag-graph-canvas]')
  const reset = root.querySelector<HTMLButtonElement>('[data-global-tag-graph-reset]')
  if (!canvas || canvas.dataset.rendered === 'true') return

  const status = canvas.querySelector<HTMLElement>('[data-global-tag-graph-status]')

  try {
    const d3 = await import('d3')
    const maxCount = Math.max(...data.nodes.map(({ count }) => count), 1)
    const maxLinkCount = Math.max(...data.links.map(({ count }) => count), 1)
    const radius = d3.scaleSqrt().domain([1, maxCount]).range([6, 18])
    const linkWidth = d3.scaleLinear().domain([1, maxLinkCount]).range([0.7, 3.5])
    const nodes: GraphNode[] = data.nodes.map(({ name, count }) => ({
      id: name,
      label: `#${name}`,
      count,
      radius: radius(count)
    }))
    const links: GraphLink[] = data.links.map((link) => ({ ...link }))
    const neighbours = new Map<string, Set<string>>()

    links.forEach(({ source, target }) => {
      const sourceId = String(source)
      const targetId = String(target)
      if (!neighbours.has(sourceId)) neighbours.set(sourceId, new Set())
      if (!neighbours.has(targetId)) neighbours.set(targetId, new Set())
      neighbours.get(sourceId)?.add(targetId)
      neighbours.get(targetId)?.add(sourceId)
    })

    const width = canvas.clientWidth || 900
    const height = canvas.clientHeight || 620
    status?.remove()
    canvas.dataset.rendered = 'true'

    const svg = d3
      .select(canvas)
      .append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', 'Graph showing relationships between all tags')

    const viewport = svg.append('g')
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.35, 3])
      .on('zoom', (event) => viewport.attr('transform', event.transform))

    svg.call(zoom)

    const link = viewport
      .append('g')
      .selectAll<SVGLineElement, GraphLink>('line')
      .data(links)
      .join('line')
      .attr('stroke', 'hsl(var(--primary) / 0.28)')
      .attr('stroke-width', (item) => linkWidth(item.count))

    const node = viewport
      .append('g')
      .selectAll<SVGGElement, GraphNode>('g')
      .data(nodes)
      .join('g')
      .attr('tabindex', 0)
      .attr('role', 'link')
      .attr('aria-label', (item) => `${item.label}, ${item.count} posts`)
      .style('cursor', 'pointer')
      .on('click', (_event, item) => {
        window.location.href = `/tags/${encodeURIComponent(item.id)}`
      })
      .on('keydown', (event: KeyboardEvent, item) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          window.location.href = `/tags/${encodeURIComponent(item.id)}`
        }
      })

    const circles = node
      .append('circle')
      .attr('r', (item) => item.radius)
      .attr('fill', 'hsl(var(--background))')
      .attr('stroke', 'hsl(var(--primary) / 0.82)')
      .attr('stroke-width', 2)

    const labels = node
      .append('text')
      .attr('x', (item) => item.radius + 4)
      .attr('y', 4)
      .attr('fill', 'hsl(var(--foreground))')
      .attr('font-size', (item) => (item.count > 2 ? 11 : 9.5))
      .attr('font-weight', (item) => (item.count > 2 ? 600 : 450))
      .text((item) => item.label)
      .style('pointer-events', 'none')

    const setFocus = (focused: GraphNode | null) => {
      const connected = focused ? (neighbours.get(focused.id) ?? new Set<string>()) : null

      circles
        .attr('fill', (item) =>
          item === focused ? 'hsl(var(--primary))' : 'hsl(var(--background))'
        )
        .attr('opacity', (item) =>
          !focused || item.id === focused.id || connected?.has(item.id) ? 1 : 0.2
        )

      labels.attr('opacity', (item) =>
        !focused || item.id === focused.id || connected?.has(item.id) ? 1 : 0.15
      )

      link
        .attr('stroke', (item) => {
          const source = item.source as GraphNode
          const target = item.target as GraphNode
          return focused && (source.id === focused.id || target.id === focused.id)
            ? 'hsl(var(--primary) / 0.8)'
            : 'hsl(var(--primary) / 0.25)'
        })
        .attr('opacity', (item) => {
          if (!focused) return 1
          const source = item.source as GraphNode
          const target = item.target as GraphNode
          return source.id === focused.id || target.id === focused.id ? 1 : 0.08
        })
    }

    node.on('mouseenter', (_event, item) => setFocus(item)).on('mouseleave', () => setFocus(null))

    const simulation = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((item) => item.id)
          .distance((item) => 105 - Math.min(item.count, 5) * 8)
          .strength((item) => Math.min(0.9, 0.3 + item.count * 0.12))
      )
      .force('charge', d3.forceManyBody().strength(-185))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('x', d3.forceX(width / 2).strength(0.035))
      .force('y', d3.forceY(height / 2).strength(0.035))
      .force(
        'collide',
        d3.forceCollide<GraphNode>().radius((item) => item.radius + 18)
      )
      .on('tick', () => {
        link
          .attr('x1', (item) => (item.source as GraphNode).x ?? 0)
          .attr('y1', (item) => (item.source as GraphNode).y ?? 0)
          .attr('x2', (item) => (item.target as GraphNode).x ?? 0)
          .attr('y2', (item) => (item.target as GraphNode).y ?? 0)

        node.attr('transform', (item) => `translate(${item.x ?? 0},${item.y ?? 0})`)
      })

    node.call(
      d3
        .drag<SVGGElement, GraphNode>()
        .on('start', (event, item) => {
          if (!event.active) simulation.alphaTarget(0.2).restart()
          item.fx = item.x
          item.fy = item.y
        })
        .on('drag', (event, item) => {
          item.fx = event.x
          item.fy = event.y
        })
        .on('end', (event, item) => {
          if (!event.active) simulation.alphaTarget(0)
          item.fx = null
          item.fy = null
        })
    )

    reset?.addEventListener('click', () => {
      svg.transition().duration(350).call(zoom.transform, d3.zoomIdentity)
      simulation.alpha(0.45).restart()
    })
  } catch (error) {
    console.error('Failed to render global tag graph:', error)
    if (status) status.textContent = 'Unable to load the tag map.'
  }
}

export function setupGlobalTagGraph() {
  document.querySelectorAll<HTMLElement>('[data-global-tag-graph]').forEach((root) => {
    if (initialized.has(root)) return

    const dataElement = root.querySelector<HTMLScriptElement>('[data-global-tag-graph-data]')
    const toggle = root.querySelector<HTMLButtonElement>('[data-global-tag-graph-toggle]')
    const content = root.querySelector<HTMLElement>('[data-global-tag-graph-content]')
    const label = root.querySelector<HTMLElement>('[data-global-tag-graph-toggle-label]')
    if (!dataElement || !toggle || !content) return
    const data = JSON.parse(dataElement.textContent || '{}') as GraphData

    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true'
      toggle.setAttribute('aria-expanded', String(!expanded))
      content.hidden = expanded
      if (label) label.textContent = expanded ? '展开预览' : '收起预览'

      if (!expanded) {
        requestAnimationFrame(() => renderGlobalTagGraph(root, data))
      }
    })
    initialized.add(root)
  })
}

setupGlobalTagGraph()
document.addEventListener('astro:page-load', setupGlobalTagGraph)
