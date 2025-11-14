// ==========================
// task-drag-drop.js - Quản lý drag and drop cho task board
// ==========================

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
            // Lấy container chứa tasks (có data-status)
            const dropZone = column.querySelector('[data-status]');
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

        // Xóa tất cả highlight từ các drop zones
        document.querySelectorAll('[data-status]').forEach(container => {
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
        // Chỉ remove class khi rời khỏi chính element đó, không phải children
        if (e.currentTarget === e.target) {
            e.currentTarget.classList.remove('drag-over');
        }
    }

    async handleDrop(e) {
        if (e.stopPropagation) {
            e.stopPropagation();
        }

        e.preventDefault();

        // Lấy container chứa các task cards (có data-status)
        let dropZone = e.currentTarget;

        // Nếu drop vào column header hoặc vùng khác, tìm đúng task container
        if (!dropZone.hasAttribute('data-status')) {
            const column = dropZone.closest('.task-column');
            dropZone = column?.querySelector('[data-status]');
        }

        if (!dropZone) {
            console.error('Không tìm thấy drop zone hợp lệ');
            return false;
        }

        dropZone.classList.remove('drag-over');

        // Lấy status mới từ column đích
        const targetColumn = dropZone.closest('.task-column');
        const newStatusId = targetColumn?.dataset.statusId;

        // Kiểm tra xem có thay đổi status không
        if (this.previousStatusId === newStatusId) {
            console.log('Task đã ở status này rồi');
            return false;
        }

        // Lưu thông tin để undo
        const sourceColumn = this.draggedElement.closest('.task-column');
        const originalHTML = this.draggedElement.outerHTML;

        // Hiển thị loading
        const loader = TaskUtils.showLoading('Đang cập nhật...');

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
                TaskUtils.saveNotificationForReload('✅ ' + result.message, 'success');
                setTimeout(() => {
                    window.location.reload();
                }, 100);
            } else {
                TaskUtils.showError(result.message);
            }
        } catch (error) {
            console.error('Error updating task status:', error);
            TaskUtils.showError('Có lỗi xảy ra khi cập nhật trạng thái');
        } finally {
            loader.remove();
        }

        return false;
    }

    // ✅ HÀM MỚI: Cập nhật pagination data sau khi drop
    updatePaginationAfterDrop(sourceColumn, targetColumn) {
        // Cập nhật SOURCE COLUMN (cột mất đi 1 task)
        if (sourceColumn) {
            const sourceTaskList = sourceColumn.querySelector('.task-list');
            const sourceCurrentCount = sourceTaskList.querySelectorAll('.task-card').length;
            const sourceCurrentPage = parseInt(sourceColumn.dataset.page) || 1;
            const sourcePageSize = parseInt(sourceColumn.dataset.pageSize) || 10;

            // Nếu đã load hết tất cả items (hasMore = false)
            // thì không cần làm gì vì sẽ không có duplicate
            const sourceHasMore = sourceColumn.dataset.hasMore === 'true';

            if (sourceHasMore) {
                // Trường hợp còn items chưa load:
                // Đánh dấu cần refresh để tránh duplicate khi scroll tiếp
                // Hoặc có thể giảm page đi 1 item
                console.log(`[Pagination] Source column has more items, current page may have gap`);

                // Option 1: Reset về trang đầu (đơn giản nhất)
                // sourceColumn.dataset.page = '1';

                // Option 2: Đánh dấu cần bù đắp 1 item từ trang sau
                sourceColumn.dataset.needsCompensation = 'true';
            }
        }

        // Cập nhật TARGET COLUMN (cột nhận thêm 1 task)
        if (targetColumn) {
            const targetTaskList = targetColumn.querySelector('.task-list');
            const targetCurrentCount = targetTaskList.querySelectorAll('.task-card').length;
            const targetCurrentPage = parseInt(targetColumn.dataset.page) || 1;
            const targetPageSize = parseInt(targetColumn.dataset.pageSize) || 10;
            const targetHasMore = targetColumn.dataset.hasMore === 'true';

            if (targetHasMore) {
                // Trường hợp còn items chưa load:
                // Item mới này sẽ nằm ở vị trí đầu/cuối danh sách
                // Khi scroll tiếp, item thứ pageSize sẽ bị duplicate
                console.log(`[Pagination] Target column received new item, needs adjustment`);

                // Đánh dấu đã có thêm 1 item "ngoài luồng"
                const extraItems = parseInt(targetColumn.dataset.extraItems || '0');
                targetColumn.dataset.extraItems = extraItems + 1;
            }
        }

        // ✅ Refresh infinite scroll observers
        if (window.infiniteScrollManager) {
            const sourceStatusId = sourceColumn?.dataset.statusId;
            const targetStatusId = targetColumn?.dataset.statusId;

            if (sourceStatusId) {
                window.infiniteScrollManager.refresh(sourceStatusId);
            }
            if (targetStatusId && targetStatusId !== sourceStatusId) {
                window.infiniteScrollManager.refresh(targetStatusId);
            }
        }
    }

    moveCardToColumn(card, targetDropZone) {
        // Lưu lại sourceColumn trước khi di chuyển
        const sourceColumn = card.closest('.task-column');
        const sourceTaskContainer = sourceColumn?.querySelector('[data-status]');

        // Xóa empty state nếu có sử dụng TaskUtils
        TaskUtils.removeEmptyState(targetDropZone);

        // Di chuyển card lên đầu column (prepend thay vì appendChild)
        targetDropZone.prepend(card);

        // Kiểm tra column nguồn có còn card không và thêm empty state
        if (sourceTaskContainer && sourceTaskContainer.querySelectorAll('.task-card').length === 0) {
            TaskUtils.addEmptyState(sourceTaskContainer);
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
    TaskUtils.checkAndShowReloadNotification();
});