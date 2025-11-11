// ==========================
// task-modal.js - Updated with shared TaskUtils
// ==========================

// Khởi tạo icon Lucide
lucide.createIcons();

// Biến DOM chính
const modal = document.getElementById('modalCreateTask');
const modalTitle = document.getElementById('modalTitle');
const btnCreateTask = document.getElementById('btnCreateTask');
const btnCloseModal = document.getElementById('btnCloseModal');
const btnCancelTask = document.getElementById('btnCancelTask');
const btnSaveTask = document.getElementById('btnSaveTask');
const form = document.getElementById('formCreateTask');
const taskIdField = document.getElementById('taskId');

// Upload file
const fileUploadArea = document.getElementById('fileUploadArea');
const fileInput = document.getElementById('taskFiles');
const uploadPlaceholder = document.getElementById('uploadPlaceholder');
const filePreview = document.getElementById('filePreview');
const fileList = document.getElementById('fileList');
let selectedFiles = [];
let isEditMode = false;

// ====== Modal control ======
if (btnCreateTask) {
    btnCreateTask.addEventListener('click', () => {
        openModalForCreate();
    });
}

function openModalForCreate() {
    isEditMode = false;
    modalTitle.textContent = 'Tạo nhiệm vụ mới';
    btnSaveTask.textContent = 'Tạo nhiệm vụ';
    taskIdField.value = '';
    modal.classList.remove('hidden');
    setTimeout(() => lucide.createIcons(), 10);
}

async function openModalForEdit(taskData) {
    isEditMode = true;
    modalTitle.textContent = 'Chỉnh sửa nhiệm vụ';
    btnSaveTask.textContent = 'Cập nhật';

    console.log('🔍 Opening modal with data:', taskData);

    // Điền dữ liệu vào form
    taskIdField.value = taskData.idTask;
    document.getElementById('taskName').value = taskData.nameTask || '';
    document.getElementById('taskDescription').value = taskData.note || '';
    document.getElementById('taskPriority').value = taskData.priority?.toLowerCase() || 'low';

    // Xử lý dates
    if (taskData.startDate) {
        const startDate = taskData.startDate.split('T')[0];
        document.getElementById('taskStartDate').value = startDate;
    }

    if (taskData.endDate) {
        const endDate = taskData.endDate.split('T')[0];
        document.getElementById('taskDeadline').value = endDate;
    }

    // Chọn project
    const projectSelect = document.getElementById('taskProjectModal');
    const assigneeSelect = document.getElementById('taskAssignee');

    console.log('🎯 Project ID:', taskData.projectId);
    projectSelect.value = taskData.projectId || '';

    // Load members trực tiếp thay vì dùng event
    if (taskData.projectId) {
        try {
            // Reset dropdown
            assigneeSelect.innerHTML = '<option value="">-- Đang tải... --</option>';
            assigneeSelect.disabled = true;

            console.log('🔄 Fetching members for project:', taskData.projectId);
            const response = await fetch(`/Task/GetMembersByProject?projectId=${taskData.projectId}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const users = await response.json();
            console.log('👥 Loaded members:', users);

            // Reset lại dropdown
            assigneeSelect.innerHTML = '<option value="">-- Chọn người --</option>';

            if (!users || users.length === 0) {
                console.warn('⚠️ No members found');
                assigneeSelect.innerHTML = '<option value="">-- Không có thành viên --</option>';
                assigneeSelect.disabled = true;
            } else {
                // Thêm tất cả members
                users.forEach(u => {
                    const option = document.createElement('option');
                    option.value = u.userId;
                    option.textContent = u.userName;
                    assigneeSelect.appendChild(option);
                });

                // Chọn assignee hiện tại nếu có
                if (taskData.assigneeId) {
                    console.log('✅ Setting assignee:', taskData.assigneeId);
                    assigneeSelect.value = taskData.assigneeId;
                }

                assigneeSelect.disabled = false;
                console.log('✅ Members loaded successfully');
            }
        } catch (err) {
            console.error('❌ Lỗi khi load danh sách members:', err);
            assigneeSelect.innerHTML = '<option value="">-- Lỗi tải dữ liệu --</option>';
            assigneeSelect.disabled = true;
            throw err; // Re-throw để catch bên ngoài bắt được
        }
    } else {
        console.warn('⚠️ No projectId found in taskData');
    }

    modal.classList.remove('hidden');
    setTimeout(() => lucide.createIcons(), 10);
}

function closeModal() {
    modal.classList.add('hidden');
    form.reset();
    selectedFiles = [];
    filePreview.classList.add('hidden');
    uploadPlaceholder.classList.remove('hidden');
    fileList.innerHTML = '';
    isEditMode = false;
    taskIdField.value = '';

    // Reset dropdown người thực hiện khi đóng modal
    const assigneeSelect = document.getElementById('taskAssignee');
    if (assigneeSelect) {
        assigneeSelect.innerHTML = '<option value="">-- Chọn người --</option>';
        assigneeSelect.disabled = true;
    }
}

if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
if (btnCancelTask) btnCancelTask.addEventListener('click', closeModal);

// Click ra ngoài để đóng
modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
});

// ====== File upload ======
fileUploadArea.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    fileInput.click();
});

fileUploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileUploadArea.classList.add('drag-over');
});

fileUploadArea.addEventListener('dragleave', () => {
    fileUploadArea.classList.remove('drag-over');
});

fileUploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    fileUploadArea.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
});

function handleFiles(files) {
    selectedFiles = Array.from(files);
    displayFiles();
}

function displayFiles() {
    if (selectedFiles.length === 0) {
        filePreview.classList.add('hidden');
        uploadPlaceholder.classList.remove('hidden');
        return;
    }

    uploadPlaceholder.classList.add('hidden');
    filePreview.classList.remove('hidden');
    fileList.innerHTML = '';

    selectedFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'flex items-center justify-between bg-gray-700 rounded-lg p-3';

        const fileInfo = document.createElement('div');
        fileInfo.className = 'flex items-center gap-3 flex-1';

        const icon = getFileIcon(file.type);
        fileInfo.innerHTML = `
            <i data-lucide="${icon}" class="w-5 h-5 text-indigo-400"></i>
            <div class="flex-1 min-w-0">
                <p class="text-sm text-gray-200 truncate">${file.name}</p>
                <p class="text-xs text-gray-400">${formatFileSize(file.size)}</p>
            </div>`;

        const btnRemove = document.createElement('button');
        btnRemove.type = 'button';
        btnRemove.className = 'text-gray-400 hover:text-red-400 transition-colors';
        btnRemove.innerHTML = '<i data-lucide="x" class="w-4 h-4"></i>';
        btnRemove.addEventListener('click', (event) => {
            event.stopPropagation();
            removeFile(index);
        });

        fileItem.appendChild(fileInfo);
        fileItem.appendChild(btnRemove);
        fileList.appendChild(fileItem);
    });

    lucide.createIcons();
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    displayFiles();
}

function getFileIcon(mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.includes('pdf')) return 'file-text';
    if (mimeType.includes('word')) return 'file-text';
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'file-spreadsheet';
    return 'file';
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ====== Save/Update task with API call ======
if (btnSaveTask) {
    btnSaveTask.addEventListener('click', async () => {
        // Validation mô tả
        const description = document.getElementById('taskDescription').value;
        if (description && description.length > 450) {
            alert('Mô tả không được vượt quá 450 ký tự!');
            return;
        }

        // Validation ngày
        const startDate = document.getElementById('taskStartDate').value;
        const endDate = document.getElementById('taskDeadline').value;
        const nameTask = document.getElementById('taskName').value;
        if (nameTask.length > 200) {
            alert('Tên dự án không vượt quá 200 ký tự');
            return;
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (startDate) {
            const selectedStart = new Date(startDate);

            // ✅ Chỉ kiểm tra ngày bắt đầu < hôm nay khi TẠO MỚI
            if (!isEditMode && selectedStart < today) {
                alert('Ngày bắt đầu không được là ngày trong quá khứ!');
                return;
            }
        }

        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);

            if (end <= start) {
                alert('Hạn chót phải sau ngày bắt đầu!');
                return;
            }

            // ✅ Khi chỉnh sửa, chỉ cần đảm bảo endDate >= hôm nay (nếu họ muốn cập nhật deadline)
            if (isEditMode && end < today) {
                alert('Không thể đặt hạn chót trong quá khứ!');
                return;
            }
        }

        // Tạo FormData
        const formData = new FormData();

        if (isEditMode) {
            formData.append('IdTask', taskIdField.value);
        }

        formData.append('NameTask', document.getElementById('taskName').value);
        formData.append('ProjectId', document.getElementById('taskProjectModal').value);

        if (description) formData.append('Note', description);

        const assignee = document.getElementById('taskAssignee').value;
        if (assignee) formData.append('AssigneeId', assignee);

        const priority = document.getElementById('taskPriority').value;
        formData.append('Priority', priority || 'low');

        if (startDate) formData.append('StartDate', startDate);
        if (endDate) formData.append('EndDate', endDate);

        // Thêm files
        selectedFiles.forEach(file => {
            formData.append('Files', file);
        });

        // Disable nút để tránh submit nhiều lần
        btnSaveTask.disabled = true;
        btnSaveTask.textContent = isEditMode ? 'Đang cập nhật...' : 'Đang tạo...';

        try {
            const url = isEditMode ? '/Task/UpdateTask' : '/Task/CreateTask';
            const response = await fetch(url, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                TaskUtils.saveNotificationForReload('✅ ' + result.message, 'success');
                closeModal();
                setTimeout(() => {
                    window.location.reload();
                }, 100);

            } else {
                TaskUtils.showSimpleToast('❌ ' + result.message, 'error');
            }
        } catch (error) {
            console.error('❌ Lỗi:', error);
            TaskUtils.showSimpleToast('❌ Đã xảy ra lỗi!', 'error');
        } finally {
            btnSaveTask.disabled = false;
            btnSaveTask.textContent = isEditMode ? 'Cập nhật' : 'Tạo nhiệm vụ';
        }
    });
}

// ==========================
// Xử lý menu 3 chấm - OUTSIDE DOMContentLoaded
// ==========================
document.addEventListener('click', (e) => {
    const menuBtn = e.target.closest('.task-menu-btn');

    if (menuBtn) {
        e.stopPropagation();
        const menu = menuBtn.parentElement.querySelector('.task-menu');

        // Đóng tất cả menu khác
        document.querySelectorAll('.task-menu').forEach(m => {
            if (m !== menu) m.classList.add('hidden');
        });

        // Toggle menu hiện tại
        menu.classList.toggle('hidden');
        lucide.createIcons();
    } else {
        // Đóng tất cả menu nếu click ra ngoài
        document.querySelectorAll('.task-menu').forEach(m => {
            m.classList.add('hidden');
        });
    }
});

// ==========================
// Xử lý nút Edit - OUTSIDE DOMContentLoaded
// ==========================
document.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.edit-task-btn');
    if (!editBtn) return;

    const taskId = editBtn.dataset.taskId;
    console.log('🖊️ Edit clicked for task:', taskId);

    try {
        const response = await fetch(`/Task/GetTaskById?taskId=${taskId}`);
        if (!response.ok) throw new Error('Không thể tải thông tin task');

        const taskData = await response.json();
        console.log('📦 Task Data loaded:', taskData);

        // CRITICAL: Phải có await để bắt lỗi khi load members
        await openModalForEdit(taskData);
    } catch (error) {
        console.error('❌ Lỗi khi load task:', error);
        TaskUtils.showError('❌ Không thể tải thông tin task!');
    }
});

// ==========================
// Xử lý nút Delete - OUTSIDE DOMContentLoaded
// ==========================
document.addEventListener('click', async (e) => {
    const deleteBtn = e.target.closest('.delete-task-btn');
    if (!deleteBtn) return;

    const taskId = deleteBtn.dataset.taskId;
    const previousStatusId = deleteBtn.dataset.statusId;
    const taskCard = deleteBtn.closest('.task-card');

    // Lưu thông tin để restore
    const parentColumn = taskCard ? taskCard.closest('.task-column') : null;
    const parentStatusId = parentColumn ? parentColumn.dataset.statusId : null;
    const originalHTML = taskCard ? taskCard.outerHTML : null;

    if (!confirm('⚠️ Bạn có chắc chắn muốn xóa nhiệm vụ này?')) {
        return;
    }

    try {
        const response = await fetch(`/Task/DeleteTask?taskId=${encodeURIComponent(taskId)}`, {
            method: 'POST'
        });

        const result = await response.json();

        if (result.success) {
            // Ẩn task card với animation
            if (taskCard) {
                taskCard.style.transition = 'all 0.18s ease';
                taskCard.style.opacity = '0';
                taskCard.style.transform = 'scale(0.96)';

                setTimeout(() => {
                    taskCard.remove();

                    // Cập nhật UI sử dụng TaskUtils
                    TaskUtils.updateTaskCounts();
                    TaskUtils.checkAndAddEmptyState(parentColumn);
                }, 200);
            }

            // Hiển thị toast với Undo sử dụng TaskUtils
            TaskUtils.showSuccessWithUndo('✅ Đã xóa nhiệm vụ', {
                taskId: taskId,
                previousStatusId: result.previousStatusId || previousStatusId,
                originalHTML: originalHTML,
                parentStatusId: parentStatusId
            });
        } else {
            TaskUtils.showError('❌ ' + result.message);
        }
    } catch (error) {
        console.error('❌ Lỗi khi xóa task:', error);
        TaskUtils.showError('❌ Đã xảy ra lỗi khi xóa nhiệm vụ!');
    }
});

// ==========================
// Load danh sách user khi chọn Project TRONG MODAL (chỉ cho CREATE)
// ==========================
document.addEventListener('DOMContentLoaded', () => {
    window.attachTaskCardEvents = attachTaskCardEvents;
    const projectSelect = document.getElementById('taskProjectModal');
    const assigneeSelect = document.getElementById('taskAssignee');

    if (!projectSelect || !assigneeSelect) {
        console.error('❌ Không tìm thấy dropdown trong modal!');
        return;
    }

    // Event này CHỈ dùng khi CREATE task mới
    projectSelect.addEventListener('change', async () => {
        const projectId = projectSelect.value;

        // Reset dropdown người thực hiện
        assigneeSelect.innerHTML = '<option value="">-- Chọn người --</option>';
        assigneeSelect.disabled = true;

        if (!projectId) return;

        try {
            const response = await fetch(`/Task/GetMembersByProject?projectId=${projectId}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const users = await response.json();

            if (!users || users.length === 0) {
                assigneeSelect.innerHTML = '<option value="">-- Không có thành viên --</option>';
                return;
            }

            users.forEach(u => {
                const option = document.createElement('option');
                option.value = u.userId;
                option.textContent = u.userName;
                assigneeSelect.appendChild(option);
            });

            assigneeSelect.disabled = false;

        } catch (err) {
            console.error('❌ Lỗi khi load danh sách:', err);
            assigneeSelect.innerHTML = '<option value="">-- Lỗi tải dữ liệu --</option>';
        }
    });

    /* Lọc theo dự án */
    const projectFilter = document.getElementById('headerProjectFilter');
    const startDateFilter = document.getElementById('startDateFilter');
    const endDateFilter = document.getElementById('endDateFilter');
    if (!projectFilter) return;

    projectFilter.addEventListener('change', async function () {
        const projectId = this.value;
        console.log("🔄 Chọn project:", projectId);

        if (!projectId) {
            // Reload trang để hiển thị tất cả tasks
            window.location.href = '/Task/Index';
            return;
        }

        try {
            const response = await fetch(`/Task/GetTaskCardsByProjectId?projectId=${projectId}`);
            if (!response.ok) throw new Error("Không thể tải danh sách nhiệm vụ.");

            const data = await response.json();
            console.log("📦 Dữ liệu nhận được:", data);

            // Mapping status với column
            const statusMapping = {
                'todoTasks': 'TO DO',
                'inProgressTasks': 'IN PROGRESS',
                'doneTasks': 'DONE',             
                'overdueTasks': 'OVERDUE'       
            };

            // Render từng column
            Object.keys(statusMapping).forEach(key => {
                const status = statusMapping[key];
                const tasks = data[key] || [];
                const columnElement = document.querySelector(`.task-column [data-status='${status}']`);

                if (columnElement) {
                    // Update task count
                    const countElement = columnElement.closest('.task-column')
                        .querySelector('.bg-gray-700\\/50.text-gray-300');
                    if (countElement) {
                        countElement.textContent = tasks.length;
                    }

                    // Render tasks
                    if (tasks.length > 0) {
                        columnElement.innerHTML = tasks.map(task => renderTaskCard(task)).join('');
                    } else {
                        columnElement.innerHTML = `
                            <div class="flex flex-col items-center justify-center py-8 text-gray-500 empty-state">
                                <i data-lucide="inbox" class="w-12 h-12 mb-2 opacity-50"></i>
                                <p class="text-sm">Không có nhiệm vụ</p>
                            </div>`;
                    }
                }
            });

            // Khởi tạo lại lucide icons
            lucide.createIcons();

            // Re-attach event listeners cho các task cards mới
            attachTaskCardEvents();
            window.taskDragDrop.init();
            console.log("✅ Đã render lại tasks thành công");
        } catch (err) {
            console.error("❌ Lỗi load tasks:", err);
            alert("Không thể tải danh sách nhiệm vụ. Vui lòng thử lại.");
        }
    });

    // Function để render task card
    function renderTaskCard(task) {
        const priorityClass = getPriorityClass(task.priority);
        const priorityBorderClass = getPriorityBorderClass(task.priority);

        return `
            <div class="task-card group bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-sm rounded-xl p-4 border
                 ${priorityBorderClass}
                 hover:shadow-lg transition-all duration-300 cursor-pointer"
                 data-task-id="${task.idTask}"
                 data-project-id="${task.projectId || ''}">

                <div class="flex items-start justify-between gap-3 mb-3">
                    <div class="flex flex-col flex-1 min-w-0">
                        <h4 class="text-gray-100 font-semibold text-sm leading-snug group-hover:text-indigo-400 transition-colors line-clamp-2 break-words">
                            ${escapeHtml(task.nameTask)}
                        </h4>
                        ${task.isDoneLate ? `
                            <span class="mt-1 inline-flex items-center gap-1 text-xs text-red-500 font-medium whitespace-nowrap">
                                <i data-lucide="clock" class="w-3 h-3 flex-shrink-0"></i>
                                <span class="truncate">Hoàn thành trễ ${task.daysLate} ngày</span>
                            </span>
                        ` : ''}
                    </div>

                    <div class="flex items-center gap-2">
                        ${task.priority ? `
                            <span class="px-2.5 py-1 ${priorityClass} text-[10px] font-bold rounded-md border uppercase tracking-wider">
                                ${task.priority}
                            </span>
                        ` : ''}

                        <div class="relative task-menu-container">
                            <button class="task-menu-btn p-1.5 hover:bg-gray-700 rounded-lg transition-colors" type="button">
                                <i data-lucide="more-vertical" class="w-4 h-4 text-gray-400"></i>
                            </button>
                            <div class="task-menu absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[140px] z-50 hidden">
                                <button class="edit-task-btn w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-700 transition-colors flex items-center gap-2"
                                        data-task-id="${task.idTask}">
                                    <i data-lucide="edit" class="w-4 h-4 text-blue-400"></i>
                                    <span>Chỉnh sửa</span>
                                </button>
                                <button class="delete-task-btn w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-700 transition-colors flex items-center gap-2"
                                        data-task-id="${task.idTask}">
                                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                                    <span>Xóa</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                ${renderDateSection(task)}
                ${renderProjectSection(task)}
                ${renderNoteSection(task)}
                ${renderFooter(task)}
            </div>
        `;
    }

    function renderDateSection(task) {
        if (!task.startDate && !task.endDate) return '';

        const startDate = task.startDate ? new Date(task.startDate).toLocaleDateString('vi-VN') : '';
        const endDate = task.endDate ? new Date(task.endDate).toLocaleDateString('vi-VN') : '';

        return `
            <div class="flex flex-col mb-3 text-[11px] text-gray-400">
                <div class="flex items-center gap-3">
                    ${task.startDate ? `
                        <div class="flex items-center gap-1.5">
                            <i data-lucide="calendar" class="w-3 h-3"></i>
                            <span>Bắt đầu: ${startDate}</span>
                        </div>
                    ` : ''}
                    ${task.endDate ? `
                        <div class="flex items-center gap-1.5 ${task.isOverdue ? 'text-red-400 font-medium' : ''}">
                            <i data-lucide="calendar-check" class="w-3 h-3"></i>
                            <span>Kết thúc: ${endDate}</span>
                        </div>
                    ` : ''}
                </div>
                ${!task.isCompleted ? `
                    ${task.isOverdue ? `
                        <span class="mt-1 inline-block text-[10px] px-2 py-0.5 rounded-md border border-red-500/30 bg-red-500/10 text-red-400">
                            Quá hạn ${Math.abs(task.daysRemaining)} ngày
                        </span>
                    ` : task.daysRemaining > 0 ? `
                        <span class="mt-1 inline-block text-[10px] px-2 py-0.5 rounded-md border border-gray-600 bg-gray-700/40 text-gray-300">
                            ${task.daysRemaining} ngày còn lại
                        </span>
                    ` : ''}
                ` : ''}
            </div>
        `;
    }

    function renderProjectSection(task) {
        if (!task.project) return '';

        return `
            <div class="flex items-center gap-2 mb-3 px-2.5 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                <i data-lucide="folder" class="w-3.5 h-3.5 text-indigo-400"></i>
                <span class="text-xs text-indigo-300 font-medium">${escapeHtml(task.project.projectName)}</span>
            </div>
        `;
    }

    function renderNoteSection(task) {
        if (!task.note) return '';

        return `
            <div class="flex items-start gap-2 mb-3 px-2.5 py-2 bg-gray-800/60 rounded-lg border border-gray-700/50">
                <i data-lucide="sticky-note" class="w-3 h-3 mt-0.5 flex-shrink-0 text-gray-500"></i>
                <p class="text-[11px] text-white-400 leading-relaxed line-clamp-2" title="${escapeHtml(task.note)}">
                    ${escapeHtml(task.note)}
                </p>
            </div>
        `;
    }

    function renderFooter(task) {
        return `
            <div class="flex items-center justify-between pt-3 border-t border-gray-700/30">
                ${task.fileNote ? `
                    <a href="${task.fileNote}"
                       target="_blank" rel="noopener noreferrer"
                       class="flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-[11px] font-medium rounded-md border border-purple-500/20 transition-all">
                        <i data-lucide="paperclip" class="w-3 h-3"></i>
                        <span>File</span>
                    </a>
                ` : '<div></div>'}

                ${task.assignee ? `
                    <div class="flex items-center gap-2 text-sm text-gray-300 group-hover:text-gray-100 transition-colors">
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(task.assignee.fullName)}&background=6366f1&color=fff&size=28"
                             alt="${escapeHtml(task.assignee.fullName)}"
                             title="${escapeHtml(task.assignee.fullName)}"
                             class="w-6 h-6 rounded-full border border-gray-600 shadow-sm ring-1 ring-gray-700 group-hover:ring-indigo-500 transition-all duration-200" />
                        <span class="truncate max-w-[120px]" title="${escapeHtml(task.assignee.fullName)}">
                            ${escapeHtml(task.assignee.fullName)}
                        </span>
                    </div>
                ` : `
                    <div class="flex items-center gap-2 text-sm text-gray-500 italic">
                        <i data-lucide="user-x" class="w-4 h-4"></i>
                        <span>Chưa giao</span>
                    </div>
                `}
            </div>
        `;
    }

    function getPriorityClass(priority) {
        const p = priority?.toUpperCase();
        switch (p) {
            case 'HIGH': return 'bg-red-500/15 text-red-400 border-red-500/30';
            case 'MEDIUM': return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30';
            case 'LOW': return 'bg-green-500/15 text-green-400 border-green-500/30';
            default: return 'bg-gray-500/15 text-gray-400 border-gray-500/30';
        }
    }

    function getPriorityBorderClass(priority) {
        const p = priority?.toUpperCase();
        switch (p) {
            case 'HIGH': return 'border-red-500/50 hover:border-red-500/75 hover:shadow-red-500/25';
            case 'MEDIUM': return 'border-yellow-500/50 hover:border-yellow-500/75 hover:shadow-yellow-500/25';
            case 'LOW': return 'border-gray-700/50 hover:border-gray-500/75 hover:shadow-gray-500/10';
            default: return 'border-gray-700/50 hover:border-gray-500/75 hover:shadow-gray-500/10';
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    function attachTaskCardEvents() {
        // ✅ Xóa tất cả event listeners cũ để tránh duplicate
        const oldBtns = document.querySelectorAll('.task-menu-btn');
        oldBtns.forEach(btn => {
            const clone = btn.cloneNode(true);
            btn.parentNode.replaceChild(clone, btn);
        });

        // ✅ Thêm event listeners mới cho menu 3 chấm
        document.querySelectorAll('.task-menu-btn').forEach(btn => {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                const menu = this.nextElementSibling;

                // Đóng tất cả menu khác
                document.querySelectorAll('.task-menu').forEach(m => {
                    if (m !== menu) m.classList.add('hidden');
                });

                // Toggle menu hiện tại
                menu.classList.toggle('hidden');
                lucide.createIcons();
            });
        });
    }
});
