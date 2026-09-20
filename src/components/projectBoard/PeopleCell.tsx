import { Employee } from '../../types';
import { displayName } from './CreateProjectModal';
import EmployeeAvatar from '../EmployeeAvatar';
import Tooltip from '../Tooltip';

// First person's avatar + name, plus a "+N" badge for the rest — shared by every table/summary
// cell that shows a group of equally-ranked people (project owners, task assignees, task
// reviewers) so they all read the same way regardless of how many are in the group. `showRole`
// adds the first person's job title on its own line underneath, for denser table rows (e.g.
// ProjectTable's "ผู้รับผิดชอบหลัก" column) where that context is worth the extra line.
export default function PeopleCell({ people, size = 20, showRole = false }: { people: Employee[]; size?: number; showRole?: boolean }) {
  if (people.length === 0) return <span className="text-xs text-[#A0A0A0]">ยังไม่มี</span>;
  const [first, ...rest] = people;
  return (
    <Tooltip
      content={
        rest.length > 0 ? (
          <div className="space-y-0.5">
            {people.map((p) => (
              <p key={p.id}>{displayName(p)}</p>
            ))}
          </div>
        ) : undefined
      }
    >
      <span className="flex items-center gap-1.5 min-w-0">
        {first.avatar ? (
          <img src={first.avatar} alt="" className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
        ) : (
          <EmployeeAvatar name={displayName(first)} sizePx={size} />
        )}
        <span className="min-w-0">
          <span className="block truncate text-xs text-[#272220]">
            {displayName(first)}{rest.length > 0 ? ` +${rest.length}` : ''}
          </span>
          {showRole && <span className="block truncate text-[11px] text-[#A0A0A0]">{first.role}</span>}
        </span>
      </span>
    </Tooltip>
  );
}
