import { Fragment, type CSSProperties } from 'react'
import { NavLink } from 'react-router-dom'
import { NAV_GROUPS, type NavItem } from '../routes/nav'

export function Sidebar() {
  return (
    <nav className="flex w-[148px] flex-shrink-0 flex-col overflow-y-auto border-r border-border-faint bg-panel px-2 py-3">
      {NAV_GROUPS.map((group, i) => (
        <Fragment key={group.label}>
          {i > 0 && <div className="mx-1 my-2 h-px bg-border-faint" />}
          <div className="px-2.5 pb-1 pt-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-fg-ghost">
            {group.label}
          </div>
          {group.items.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </Fragment>
      ))}
      <div className="flex-1" />
    </nav>
  )
}

function SidebarLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        [
          'mb-0.5 block rounded-lg px-3 py-2.5 text-[13px] transition-all',
          isActive
            ? 'border-l-[3px] pl-[9px]'
            : 'hover:bg-card hover:text-fg-muted',
        ].join(' ')
      }
      style={({ isActive }): CSSProperties => ({
        color: isActive ? item.activeColor : item.defaultColor,
        background: isActive ? item.activeBg : undefined,
        borderLeftColor: isActive ? item.activeColor : undefined,
        fontWeight: item.weight ?? 500,
      })}
    >
      {item.label}
    </NavLink>
  )
}
