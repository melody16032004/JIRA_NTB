// task-drag-drop.js - Quản lý drag and drop cho task board

class TaskDragDrop {
    constructor() {
        this.draggedElement = null;
        this.draggedTaskId = null;
        this.draggedStatusId = null;
        this.previousStatusId = null;
        this.init();
    }

    init() {
        this.initDragListeners();
        this.initDropZones();
    }

    // Khởi tạo drag listeners cho tất cả task cards
    initDragListeners() {
        const taskCards = document.querySelectorAll('.task-card');
        taskCards.forEach(card => {
            card.setAttribute('draggable', 'true');

            card.addEventListener('dragstart', (e) => this.handleDragStart(e));
            card.addEventListener('dragend', (e) => this.handleDragEnd(e));
        });
    }

    // Khởi tạo drop zones cho các columns
    initDropZones() {
        const columns = document.querySelectorAll('.task-column');
        columns.forEach(column => {
            const dropZone = column.querySelector('.tasks-container');
            if (dropZone) {
                dropZone.addEventListener('dragover', (e) => this.handleDragOver(e));
                dropZone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
                dropZone.addEventListener('drop', (e) => this.handleDrop(e));
            }
        });
    }

    handleDragStart(e) {
        this.draggedElement = e.currentTarget;
        this.draggedTaskId = e.currentTarget.dataset.taskId;

        // Lấy status hiện tại từ column cha
        const column = e.currentTarget.closest('.task-column');
        this.previousStatusId = column?.dataset.statusId;

        // Thêm class để làm mờ card đang kéo
        e.currentTarget.classList.add('dragging');

        // Set data cho drag event
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.currentTarget.innerHTML);
    }

    handleDragEnd(e) {
        e.currentTarget.classList.remove('dragging');

        // Xóa tất cả highlight
        document.querySelectorAll('.tasks-container').forEach(container => {
            container.classList.remove('drag-over');
        });
    }

    handleDragOver(e) {
        if (e.preventDefault) {
            e.preventDefault();
        }

        e.dataTransfer.dropEffect = 'move';

        const dropZone = e.currentTarget;
        dropZone.classList.add('drag-over');

        return false;
    }

    handleDragLeave(e) {
        e.currentTarget.classList.remove('drag-over');
    }

    async handleDrop(e) {
        if (e.stopPropagation) {
            e.stopPropagation();
        }

        e.preventDefault();

        const dropZone = e.currentTarget;
        dropZone.classList.remove('drag-over');

        // Lấy status mới từ column đích
        const targetColumn = dropZone.closest('.task-column');
        const newStatusId = targetColumn?.dataset.statusId;

        // Kiểm tra xem có thay đổi status không
        if (this.previousStatusId === newStatusId) {
            console.log('Task đã ở status này rồi');
            return false;
        }

        // Hiển thị loading
        this.showLoading();

        try {
            // Gọi API để cập nhật status
            const response = await fetch('/Task/UpdateStatus', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    taskId: this.draggedTaskId,
                    newStatusId: newStatusId
                })
            });

            const result = await response.json();

            if (result.success) {
                // Di chuyển card đến column mới
                this.moveCardToColumn(this.draggedElement, dropZone);

                // Cập nhật số lượng tasks
                this.updateTaskCounts();

                // Hiển thị thông báo thành công với nút Undo
                this.showSuccessWithUndo(result.message, result.data);
            } else {
                this.showError(result.message);
            }
        } catch (error) {
            console.error('Error updating task status:', error);
            this.showError('Có lỗi xảy ra khi cập nhật trạng thái');
        } finally {
            this.hideLoading();
        }

        return false;
    }

    moveCardToColumn(card, targetDropZone) {
        // Kiểm tra xem column có empty state không
        const emptyState = targetDropZone.querySelector('.empty-state');
        if (emptyState) {
            emptyState.remove();
        }

        // Di chuyển card
        targetDropZone.appendChild(card);

        // Kiểm tra column nguồn có còn card không
        const sourceColumn = card.closest('.task-column');
        const sourceDropZone = sourceColumn?.querySelector('.tasks-container');
        if (sourceDropZone && sourceDropZone.querySelectorAll('.task-card').length === 0) {
            this.addEmptyState(sourceDropZone);
        }
    }

    addEmptyState(container) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `
            <div class="text-center py-8 px-4">
                <div class="text-gray-500 mb-2">
                    <i data-lucide="inbox" class="w-12 h-12 mx-auto mb-2"></i>
                </div>
                <p class="text-gray-400 text-sm">Không có nhiệm vụ</p>
            </div>
        `;
        container.appendChild(emptyState);

        // Refresh lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    updateTaskCounts() {
        const columns = document.querySelectorAll('.task-column');
        columns.forEach(column => {
            const taskCount = column.querySelectorAll('.task-card').length;
            const badge = column.querySelector('.task-count-badge');
            if (badge) {
                badge.textContent = taskCount;
            }
        });
    }

    showSuccessWithUndo(message, data) {
        // Tạo toast notification với nút Undo
        const toast = document.createElement('div');
        toast.className = 'fixed bottom-4 right-4 bg-green-600 text-white px-6 py-4 rounded-lg shadow-xl z-50 flex items-center gap-3 animate-slide-up';
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

        // Refresh lucide icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

        // Xử lý nút Undo
        const undoBtn = toast.querySelector('.undo-btn');
        undoBtn.addEventListener('click', () => {
            this.undoStatusChange(data);
            toast.remove();
        });

        // Xử lý nút đóng
        const closeBtn = toast.querySelector('.close-toast');
        closeBtn.addEventListener('click', () => {
            toast.remove();
        });

        // Tự động ẩn sau 8 giây
        setTimeout(() => {
            if (toast.parentNode) {
                toast.classList.add('animate-slide-down');
                setTimeout(() => toast.remove(), 300);
            }
        }, 8000);
    }

    async undoStatusChange(data) {
        this.showLoading();

        try {
            const response = await fetch('/Task/UndoStatus', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    taskId: data.taskId,
                    previousStatusId: data.previousStatusId
                })
            });

            const result = await response.json();

            if (result.success) {
                // Reload trang để cập nhật lại UI
                location.reload();
            } else {
                this.showError(result.message);
            }
        } catch (error) {
            console.error('Error undoing status change:', error);
            this.showError('Có lỗi xảy ra khi hoàn tác');
        } finally {
            this.hideLoading();
        }
    }

    showError(message) {
        const toast = document.createElement('div');
        toast.className = 'fixed bottom-4 right-4 bg-red-600 text-white px-6 py-4 rounded-lg shadow-xl z-50 flex items-center gap-3 animate-slide-up';
        toast.innerHTML = `
            <i data-lucide="alert-circle" class="w-5 h-5"></i>
            <span>${message}</span>
            <button class="close-toast ml-2 text-white/70 hover:text-white">
                <i data-lucide="x" class="w-4 h-4"></i>
            </button>
        `;

        document.body.appendChild(toast);

        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

        toast.querySelector('.close-toast').addEventListener('click', () => {
            toast.remove();
        });

        setTimeout(() => {
            if (toast.parentNode) {
                toast.classList.add('animate-slide-down');
                setTimeout(() => toast.remove(), 300);
            }
        }, 5000);
    }

    showLoading() {
        const loader = document.createElement('div');
        loader.id = 'drag-drop-loader';
        loader.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
        loader.innerHTML = `
            <div class="bg-gray-800 rounded-lg p-6 flex items-center gap-3">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                <span class="text-white">Đang cập nhật...</span>
            </div>
        `;
        document.body.appendChild(loader);
    }

    hideLoading() {
        const loader = document.getElementById('drag-drop-loader');
        if (loader) {
            loader.remove();
        }
    }

    // Phương thức để refresh lại drag listeners khi có task mới
    refresh() {
        this.initDragListeners();
    }
}

// Khởi tạo khi DOM ready
document.addEventListener('DOMContentLoaded', function () {
    window.taskDragDrop = new TaskDragDrop();
});