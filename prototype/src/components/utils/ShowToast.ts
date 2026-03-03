export function ShowToast(message: string, type: 'success' | 'danger') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast align-items-center text-white bg-${type} border-0`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  toast.setAttribute('aria-atomic', 'true');

  const wrapper = document.createElement('div');
  wrapper.className = 'd-flex';

  const body = document.createElement('div');
  body.className = 'toast-body';
  body.textContent = message;

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn-close btn-close-white me-2 m-auto';
  closeBtn.setAttribute('data-bs-dismiss', 'toast');
  closeBtn.setAttribute('aria-label', 'Close');

  wrapper.appendChild(body);
  wrapper.appendChild(closeBtn);
  toast.appendChild(wrapper);

  container.appendChild(toast);

  // @ts-ignore
  const bsToast = new bootstrap.Toast(toast, { delay: type === 'danger' ? 5000 : 3000 });
  bsToast.show();

  toast.addEventListener('hidden.bs.toast', () => toast.remove());
}
