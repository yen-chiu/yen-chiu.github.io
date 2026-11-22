import type { Element, Root } from 'hast'
import { visit } from 'unist-util-visit'

// GFM task-list checkboxes are rendered as <input type="checkbox" disabled>.
// They are decorative state markers, not controls: without a label axe flags
// them ("Form elements do not have associated labels") and screen readers
// announce a generic form control in the middle of prose.
export default function rehypeTaskListA11y() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'input') return
      const { type, disabled } = node.properties ?? {}
      if (type !== 'checkbox' || !disabled) return
      node.properties = {
        ...node.properties,
        ariaHidden: 'true',
        tabIndex: -1
      }
    })
  }
}
