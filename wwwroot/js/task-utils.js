// ==========================
// task-utils.js - Shared utilities cho task management
// ==========================

const TaskUtils = {
    // ====== UI Update Functions ======

    updateTaskCounts() {
        const columns = document.querySelectorAll('.task-column');
        columns.forEach(column => {
            const taskContainer = column.querySelector('[data-status]');
            const taskCount = taskContainer ? taskContainer.querySelectorAll('.task-card').length : 0;

            const badge = column.querySelector('span.bg-gray-700\\/50');
            if (badge) {
                badge.textContent = taskCount;
            }
        });
    },

    addEmptyState(container) {
        if (!container) return;

        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state flex flex-col items-center justify-center py-8 text-gray-500';
        emptyState.innerHTML = `
            <i data-lucide="inbox" class="w-12 h-12 mb-2 opacity-50"></i>
            <p class="text-sm">Không có nhiệm vụ</p>
        `;
        container.appendChild(emptyState);

        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    },

    removeEmptyState(container) {
        if (!container) return;
        const emptyState = container.querySelector('.empty-state');
        if (emptyState) {
            emptyState.remove();
        }
    },

    checkAndAddEmptyState(column) {
        if (!column) return;

        const taskContainer = column.querySelector('[data-status]');
        if (taskContainer && taskContainer.querySelectorAll('.task-card').length === 0) {
            this.addEmptyState(taskContainer);
        }
    },

    // ====== Toast Notifications ======

    showSuccessWithUndo(message, undoData) {
        const toast = document.createElement('div');
        toast.className = 'fixed top-5 right-5 bg-gray-800 text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50 animate-slide-up';
        toast.style.transition = 'all 0.3s ease';
        toast.innerHTML = `
            <i data-lucide="check-circle" class="w-5 h-5"></i>
            <span class="flex-1">${message}</span>
            <button class="undo-btn px-3 py-1 bg-white/20 hover:bg-white/30 rounded transition-colors text-sm font-medium">
                Hoàn tác
            </button>
            <button class="close-toast ml-2 text-white/70 hover:text-white">
                <i data-lucide="x" class="w-4 h-4"></i>
            </button>
        `;
        document.body.appendChild(toast);
        if (typeof lucide !== 'undefined') lucide.createIcons();

        // Progress bar
        const progressBar = document.createElement('div');
        progressBar.className = 'absolute bottom-0 left-0 h-1 bg-indigo-500 rounded-b-lg';
        progressBar.style.width = '100%';
        progressBar.style.transition = 'width 5s linear';
        toast.appendChild(progressBar);
        setTimeout(() => progressBar.style.width = '0%', 10);

        const hideTimeout = setTimeout(() => {
            this.hideToast(toast);
        }, 5000);

        toast.querySelector('.close-toast').addEventListener('click', () => {
            clearTimeout(hideTimeout);
            this.hideToast(toast);
        });

        toast.querySelector('.undo-btn').addEventListener('click', async () => {
            clearTimeout(hideTimeout);
            toast.remove();
            await this.handleUndo(undoData);
        });
    },

    async handleUndo(undoData) {
        // Hiển thị loading
        const loader = this.showLoading('Đang hoàn tác...');

        try {
            const response = await fetch('/Task/UndoStatus', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    taskId: undoData.taskId,
                    previousStatusId: undoData.previousStatusId
                })
            });
            const result = await response.json();
            loader.remove();

            if (result.success) {
                // Lưu lại column nguồn (nơi task đang ở) trước khi xóa
                const existingCard = document.querySelector(`.task-card[data-task-id="${undoData.taskId}"]`);
                const sourceColumn = existingCard?.closest('.task-column');

                // Xóa task hiện tại khỏi cột nguồn
                if (existingCard) {
                    existingCard.remove();
                }

                // Tìm column đích để khôi phục task
                const targetColumn = this.findTargetColumn(undoData);

                if (targetColumn && undoData.originalHTML) {
                    await this.restoreTaskCard(targetColumn, undoData.originalHTML);

                    // ✅ Xóa empty state ở cột đích (vì đã có task)
                    const targetTaskContainer = targetColumn.querySelector('[data-status]');
                    this.removeEmptyState(targetTaskContainer);

                    // ✅ Thêm empty state vào cột nguồn nếu không còn task
                    if (sourceColumn) {
                        this.checkAndAddEmptyState(sourceColumn);
                    }

                    // ✅ Cập nhật task count
                    this.updateTaskCounts();

                    this.showSimpleToast('✅ Đã hoàn tác thành công', 'success');
                } else {
                    // Fallback: reload trang
                    this.showSimpleToast('✅ Đã hoàn tác thành công', 'success');
                    location.reload();
                }
            } else {
                this.showSimpleToast('❌ ' + result.message, 'error');
            }
        } catch (error) {
            console.error('❌ Undo error:', error);
            loader.remove();
            this.showSimpleToast('❌ Lỗi khi hoàn tác!', 'error');
        }
    },

    findTargetColumn(undoData) {
        // Ưu tiên tìm theo parentStatusId (từ column ban đầu)
        const statusId = undoData.parentStatusId || undoData.previousStatusId;

        if (statusId) {
            let column = document.querySelector(`.task-column[data-status-id="${statusId}"]`);
            if (!column) {
                column = document.querySelector(`.task-column[data-status="${statusId}"]`);
            }
            if (column) return column;
        }

        // Fallback: tìm cột đầu tiên
        return document.querySelector('.task-column');
    },

    async restoreTaskCard(targetColumn, originalHTML) {
        const taskContainer = targetColumn.querySelector('[data-status]');
        if (!taskContainer) return;

        // ❌ KHÔNG xóa empty state ở đây nữa - để handleUndo xử lý

        // Khôi phục task card
        const temp = document.createElement('div');
        temp.innerHTML = originalHTML;
        const restored = temp.firstElementChild;

        restored.style.opacity = '0';
        restored.style.transform = 'scale(0.96)';
        taskContainer.prepend(restored);

        // Animation hiện card
        setTimeout(() => {
            restored.style.transition = 'all 0.25s ease';
            restored.style.opacity = '1';
            restored.style.transform = 'scale(1)';
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }, 10);

        this.attachTaskCardEventListeners(restored);

        // Nếu có drag-drop instance, refresh listeners
        if (window.taskDragDrop) {
            window.taskDragDrop.refresh();
        }
    },
    // ✅ Hàm mới: Attach event listeners cho một task card cụ thể
    attachTaskCardEventListeners(taskCard) {
        if (!taskCard) return;

        // Xử lý nút menu 3 chấm
        const menuBtn = taskCard.querySelector('.task-menu-btn');
        if (menuBtn) {
            // Xóa event listener cũ (nếu có)
            const newBtn = menuBtn.cloneNode(true);
            menuBtn.parentNode.replaceChild(newBtn, menuBtn);

            // Thêm event listener mới
            newBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                const menu = this.nextElementSibling;

                // Đóng tất cả menu khác
                document.querySelectorAll('.task-menu').forEach(m => {
                    if (m !== menu) m.classList.add('hidden');
                });

                // Toggle menu hiện tại
                menu.classList.toggle('hidden');
                if (typeof lucide !== 'undefined') lucide.createIcons();
            });
        }
    },
    showSimpleToast(message, type = 'success') {
        const bgColor = type === 'success' ? 'bg-green-600' : 'bg-red-600';
        const icon = type === 'success' ? 'check-circle' : 'alert-circle';

        const toast = document.createElement('div');
        toast.className = `fixed top-4 right-4 ${bgColor} text-white px-6 py-4 rounded-lg shadow-xl z-50 flex items-center gap-3 animate-slide-up`;
        toast.style.transition = 'all 0.3s ease';
        toast.innerHTML = `
            <i data-lucide="${icon}" class="w-5 h-5"></i>
            <span>${message}</span>
            <button class="close-toast ml-2 text-white/70 hover:text-white">
                <i data-lucide="x" class="w-4 h-4"></i>
            </button>
        `;

        document.body.appendChild(toast);
        if (typeof lucide !== 'undefined') lucide.createIcons();

        toast.querySelector('.close-toast').addEventListener('click', () => {
            this.hideToast(toast);
        });

        setTimeout(() => {
            if (toast.parentNode) {
                this.hideToast(toast);
            }
        }, 3000);
    },

    hideToast(toast) {
        toast.style.opacity = '0';
        toast.style.transform = toast.className.includes('bottom-')
            ? 'translateY(10px)'
            : 'translateY(-10px)';
        setTimeout(() => toast.remove(), 300);
    },

    showLoading(message = 'Đang xử lý...') {
        const loader = document.createElement('div');
        loader.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
        loader.innerHTML = `
            <div class="bg-gray-800 rounded-lg p-6 flex items-center gap-3">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                <span class="text-white">${message}</span>
            </div>
        `;
        document.body.appendChild(loader);
        return loader;
    },

    showError(message) {
        this.showSimpleToast(message, 'error');
    },
    // Lưu notification để hiện sau khi reload
    saveNotificationForReload(message, type = 'success') {
        sessionStorage.setItem('taskNotification', JSON.stringify({
            message: message,
            type: type,
            timestamp: Date.now()
        }));
    },

    // Kiểm tra và hiện notification sau reload
    checkAndShowReloadNotification() {
        const notification = sessionStorage.getItem('taskNotification');
        if (notification) {
            try {
                const data = JSON.parse(notification);

                // Chỉ hiện nếu notification dưới 5 giây (tránh hiện lại khi back/forward)
                if (Date.now() - data.timestamp < 5000) {
                    this.showSimpleToast(data.message, data.type);
                }

                sessionStorage.removeItem('taskNotification');
            } catch (e) {
                console.error('Error parsing notification:', e);
                sessionStorage.removeItem('taskNotification');
            }
        }
    }
};

// Export để sử dụng ở các file khác
if (typeof window !== 'undefined') {
    window.TaskUtils = TaskUtils;
}