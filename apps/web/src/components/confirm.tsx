import { useMutation } from '@tanstack/react-query';
import { Modal } from './modal';
import { Button, ErrorNotice } from './ui';

export function Confirm({
  title,
  description,
  actionLabel = 'Archive',
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onConfirm: () => Promise<unknown>;
  onClose: () => void;
}) {
  const mutation = useMutation({ mutationFn: onConfirm, onSuccess: onClose });
  return (
    <Modal
      title={title}
      description={description}
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
    >
      {mutation.isError ? <ErrorNotice error={mutation.error} /> : null}
      <div className="modal-actions">
        <Button variant="secondary" disabled={mutation.isPending} onClick={onClose}>
          Keep it
        </Button>
        <Button variant="danger" loading={mutation.isPending} onClick={() => mutation.mutate()}>
          {actionLabel}
        </Button>
      </div>
    </Modal>
  );
}
