// task-infinite-scroll.js
class InfiniteScrollManager {
    constructor() {
        this.loadingColumns = new Set();
        this.observers = new Map();
        this.pageSize = 10;

        this.init();
    }

    init() {
        // Đợi DOM và Lucide icons render xong
        setTimeout(() => {
            const columns = document.querySelectorAll('.task-column');

            columns.forEach((column, index) => {
                this.setupColumnObserver(column);
            });
        }, 200);
    }

    setupColumnObserver(column) {
        //console.log(`column data: ${column.dataset.statusId}`);
        const taskList = column.querySelector('.task-list');
        const statusId = column.dataset.statusId;
        const hasMore = column.dataset.hasMore;

        if (!taskList) {
            console.warn(`[InfiniteScroll] Task list not found for column: ${statusId}`);
            return;
        }

        // Chỉ setup observer nếu có thêm data để load
        if (hasMore !== 'true') {
            //console.log(`[InfiniteScroll] No more data for ${statusId}, skip observer`);
            return;
        }

        // Tạo sentinel element ở cuối danh sách
        const sentinel = document.createElement('div');
        sentinel.className = 'scroll-sentinel';
        sentinel.style.height = '10px';
        sentinel.style.width = '100%';
        sentinel.dataset.statusId = statusId;
        taskList.appendChild(sentinel);

        // Tạo Intersection Observer với root là taskList (scroll container)
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    this.handleIntersection(entry, column);
                });
            },
            {
                root: taskList, // Quan trọng: phải set root là scroll container
                rootMargin: '100px', // Trigger sớm hơn
                threshold: 0.01 // Chỉ cần 1% visible
            }
        );

        observer.observe(sentinel);
        this.observers.set(statusId, { observer, sentinel });
    }

    async handleIntersection(entry, column) {
        if (!entry.isIntersecting) return;

        const statusId = column.dataset.statusId;
        const hasMore = column.dataset.hasMore === 'true';

        // Kiểm tra điều kiện load
        if (!hasMore) {
            console.log(`[InfiniteScroll] No more data for ${statusId}`);
            return;
        }

        if (this.loadingColumns.has(statusId)) {
            console.log(`[InfiniteScroll] Already loading ${statusId}`);
            return;
        }

        // Load thêm dữ liệu
        await this.loadMoreTasks(column);
    }

    async loadMoreTasks(column) {
        const statusId = column.dataset.statusId;
        console.log(`page hiện tại: ${column.dataset.page}`)
        const currentPage = parseInt(column.dataset.page) || 1;
        const nextPage = currentPage + 1;
        const columnPageSize = column.dataset.pageSize || this.pageSize;

        // ✅ Kiểm tra xem có extraItems không (từ drag & drop)
        const extraItems = parseInt(column.dataset.extraItems || '0');

        // Đánh dấu đang loading
        this.loadingColumns.add(statusId);
        this.showLoading(column, true);
        const projectFilter = document.getElementById('headerProjectFilter');
        const projectId = projectFilter ? projectFilter.value : '';

        try {
            // Gọi API
            const url = `/Task/GetMoreTasks?statusId=${encodeURIComponent(statusId)}&page=${nextPage}&pageSize=${columnPageSize}&projectId=${encodeURIComponent(projectId || '')}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const html = await response.text();

            // Parse HTML response
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            let newTasks = doc.querySelectorAll('.task-card');

            if (newTasks.length > 0) {
                // ✅ Xử lý duplicate nếu có extraItems
                newTasks = this.handleDuplicateItems(column, newTasks, extraItems);

                if (newTasks.length > 0) {
                    // Append tasks vào column
                    this.appendTasks(column, newTasks);

                    // Cập nhật page number
                    column.dataset.page = nextPage;

                    // Cập nhật counter
                    this.updateTaskCounter(column, newTasks.length);

                    // Re-initialize Lucide icons
                    if (typeof lucide !== 'undefined') {
                        lucide.createIcons();
                    }
                }

                // ✅ Reset extraItems sau khi xử lý
                column.dataset.extraItems = '0';

                // Kiểm tra còn task không
                if (newTasks.length < columnPageSize) {
                    console.log(`[InfiniteScroll] No more tasks for ${statusId}`);
                    column.dataset.hasMore = 'false';
                    this.removeLoadingIndicator(column);
                    this.destroyObserver(statusId); // Hủy observer
                } else {
                    console.log(`[InfiniteScroll] More tasks available for ${statusId}`);
                }
            } else {
                // Không còn task
                console.log(`[InfiniteScroll] Empty response for ${statusId}`);
                column.dataset.hasMore = 'false';
                this.removeLoadingIndicator(column);
                this.destroyObserver(statusId);
            }

        } catch (error) {
            console.error('[InfiniteScroll] Error:', error);
            this.showError(column, 'Không thể tải thêm nhiệm vụ');
        } finally {
            this.loadingColumns.delete(statusId);
            this.showLoading(column, false);
        }
    }

    // ✅ HÀM MỚI: Xử lý duplicate items do drag & drop
    handleDuplicateItems(column, newTasks, extraItems) {
        if (extraItems <= 0) {
            return newTasks; // Không có extra items, trả về như cũ
        }

        const taskList = column.querySelector('.task-list');
        const existingTaskIds = new Set();

        // Lấy tất cả task IDs hiện có trong DOM
        taskList.querySelectorAll('.task-card').forEach(card => {
            const taskId = card.dataset.taskId;
            if (taskId) {
                existingTaskIds.add(taskId);
            }
        });

        // Lọc bỏ các items đã tồn tại
        const filteredTasks = Array.from(newTasks).filter(task => {
            const taskId = task.dataset.taskId;
            if (existingTaskIds.has(taskId)) {
                console.log(`[InfiniteScroll] Skipping duplicate task: ${taskId}`);
                return false;
            }
            return true;
        });

        console.log(`[InfiniteScroll] Filtered ${newTasks.length - filteredTasks.length} duplicate items`);

        return filteredTasks;
    }

    appendTasks(column, newTasks) {
        const taskList = column.querySelector('.task-list');
        const sentinel = taskList.querySelector('.scroll-sentinel');
        const emptyState = taskList.querySelector('.empty-state');

        // Xóa empty state nếu có
        if (emptyState) {
            emptyState.remove();
        }

        // Insert tasks trước sentinel
        newTasks.forEach((task, index) => {
            const clonedTask = task.cloneNode(true);
            taskList.insertBefore(clonedTask, sentinel);

            // Animation fade-in với delay
            clonedTask.style.opacity = '0';
            clonedTask.style.transform = 'translateY(20px)';

            setTimeout(() => {
                clonedTask.style.transition = 'all 0.3s ease';
                clonedTask.style.opacity = '1';
                clonedTask.style.transform = 'translateY(0)';
            }, index * 50); // Stagger animation
        });

        // Re-attach event listeners
        //this.attachTaskEventListeners(taskList);
        if (window.taskDragDrop) {
            window.taskDragDrop.refresh();
            console.log('[InfiniteScroll] Drag & Drop listeners refreshed');
        }
    }

    showLoading(column, show) {
        const loadingIndicator = column.querySelector('.loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.classList.toggle('hidden', !show);
        }
    }

    removeLoadingIndicator(column) {
        const loadingIndicator = column.querySelector('.loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
    }

    updateTaskCounter(column, addedCount) {
        const counter = column.querySelector('.bg-gray-700\\/50');
        if (counter) {
            const text = counter.textContent.trim();
            const match = text.match(/(\d+)\s*\/\s*(\d+)/);

            if (match) {
                const current = parseInt(match[1]) + addedCount;
                const total = parseInt(match[2]);
                counter.textContent = `${current} / ${total}`;
            }
        }
    }

    showError(column, message) {
        const taskList = column.querySelector('.task-list');
        const errorEl = document.createElement('div');
        errorEl.className = 'text-red-400 text-xs text-center py-2 bg-red-900/20 rounded-lg border border-red-500/30';
        errorEl.textContent = message;
        taskList.appendChild(errorEl);

        setTimeout(() => errorEl.remove(), 3000);
    }

    attachTaskEventListeners(container) {
        // Re-attach menu toggle
        container.querySelectorAll('.task-menu-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const menu = btn.nextElementSibling;
                menu.classList.toggle('hidden');
            });
        });

        // Re-attach edit/delete handlers
        container.querySelectorAll('.edit-task-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                const taskId = this.dataset.taskId;
                if (typeof window.openEditTaskModal === 'function') {
                    window.openEditTaskModal(taskId);
                }
            });
        });

        container.querySelectorAll('.delete-task-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                const taskId = this.dataset.taskId;
                if (typeof window.deleteTask === 'function') {
                    window.deleteTask(taskId);
                }
            });
        });

        // Re-attach task card click
        container.querySelectorAll('.task-card').forEach(card => {
            card.addEventListener('click', function (e) {
                if (!e.target.closest('.task-menu-container')) {
                    const taskId = this.dataset.taskId;
                    if (typeof window.openTaskDetail === 'function') {
                        window.openTaskDetail(taskId);
                    }
                }
            });
        });
    }

    // Hủy observer cho một cột cụ thể
    destroyObserver(statusId) {
        const observerData = this.observers.get(statusId);
        if (observerData) {
            observerData.observer.disconnect();
            if (observerData.sentinel && observerData.sentinel.parentNode) {
                observerData.sentinel.remove();
            }
            this.observers.delete(statusId);
            console.log(`[InfiniteScroll] Observer destroyed for ${statusId}`);
        }
    }

    // ✅ CẬP NHẬT: Refresh - gọi khi có thay đổi (create, update, delete task)
    refresh(statusId = null) {
        if (statusId) {
            // Reset specific column
            const column = document.querySelector(`.task-column[data-status-id="${statusId}"]`);
            if (column) {
                // ✅ KHÔNG reset page về 1, giữ nguyên vị trí hiện tại
                // column.dataset.page = '1';

                // Giữ nguyên hasMore nếu trước đó còn data
                // column.dataset.hasMore = 'true';

                // Recreate observer nếu cần
                const hasMore = column.dataset.hasMore === 'true';
                if (hasMore && !this.observers.has(statusId)) {
                    this.setupColumnObserver(column);
                }

                console.log(`[InfiniteScroll] Refreshed column ${statusId}`);
            }
        } else {
            // Reset all columns
            document.querySelectorAll('.task-column').forEach(column => {
                const statusId = column.dataset.statusId;
                const hasMore = column.dataset.hasMore === 'true';

                if (hasMore && !this.observers.has(statusId)) {
                    this.setupColumnObserver(column);
                }
            });
        }
    }

    // Destroy all observers
    destroy() {
        console.log('[InfiniteScroll] Destroying all observers');
        this.observers.forEach((data, statusId) => {
            data.observer.disconnect();
            if (data.sentinel && data.sentinel.parentNode) {
                data.sentinel.remove();
            }
        });
        this.observers.clear();
        this.loadingColumns.clear();
    }
}

// Initialize khi DOM ready
document.addEventListener('DOMContentLoaded', () => {
    //console.log('[InfiniteScroll] Initializing...');
    window.infiniteScrollManager = new InfiniteScrollManager();
});

// Cleanup khi leave page
window.addEventListener('beforeunload', () => {
    if (window.infiniteScrollManager) {
        window.infiniteScrollManager.destroy();
    }
});