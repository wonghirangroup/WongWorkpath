// Small red count badge pinned to a comment icon's corner — shared by every task table that shows
// a "ความคิดเห็น" action icon (ProjectDetail.tsx's ภาพรวม/งาน tabs, MyWorkspace.tsx), so the three
// stay visually identical. Caller is responsible for only rendering this when count > 0 and for
// giving the icon button `className="relative ..."` so this positions against it correctly.
export default function CommentCountBadge({ count }: { count: number }) {
  return (
    <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[14px] h-[14px] px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold leading-none pointer-events-none">
      {count > 99 ? '99+' : count}
    </span>
  );
}
