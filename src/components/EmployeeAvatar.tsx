import { getAvatarColor } from '../lib/avatarColor';

interface EmployeeAvatarProps {
  name: string;
  sizePx?: number;
}

// Colored-initials circle — the app's one "default avatar" convention, shown wherever an employee
// has no photo instead of letting a bare `<img src="">` render a broken/blank image. Shared here
// (rather than redefined per file) since it's used identically across the project board, employee
// search/multi-select pickers, and the org chart.
export default function EmployeeAvatar({ name, sizePx = 32 }: EmployeeAvatarProps) {
  return (
    <div
      className="rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
      style={{ backgroundColor: getAvatarColor(name), width: sizePx, height: sizePx }}
    >
      {name.trim().charAt(0).toUpperCase()}
    </div>
  );
}
