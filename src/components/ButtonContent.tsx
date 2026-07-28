import type { ReactNode } from 'react';

interface ButtonContentProps {
  label: string;
  busy?: boolean;
  busyLabel?: string;
  icon?: ReactNode;
  trailingIcon?: ReactNode;
}

export function ButtonContent({
  label,
  busy = false,
  busyLabel = 'Đang xử lý...',
  icon,
  trailingIcon
}: ButtonContentProps) {
  const visibleLabel = busy ? busyLabel : label;

  return (
    <>
      {busy ? (
        <span
          aria-hidden="true"
          className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : icon ? (
        <span aria-hidden="true" className="grid shrink-0 place-items-center">
          {icon}
        </span>
      ) : null}
      <span className="ui-action-button__label" title={visibleLabel}>
        {visibleLabel}
      </span>
      {!busy && trailingIcon ? (
        <span aria-hidden="true" className="grid shrink-0 place-items-center">
          {trailingIcon}
        </span>
      ) : null}
    </>
  );
}
