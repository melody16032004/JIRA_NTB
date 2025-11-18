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
            TaskUtils.saveNotificationForReload('✅ ' + result.message, 'success');
            setTimeout(() => {
                window.location.reload();
            }, 100);
        } else {
            TaskUtils.showError('❌ ' + result.message);
        }
    } catch (error) {
        console.error('❌ Lỗi khi xóa task:', error);
        TaskUtils.showError('❌ Đã xảy ra lỗi khi xóa nhiệm vụ!');
    }
});
// ==========================
// Xử lý nút Reassign / Thay người
// ==========================
document.addEventListener('click', async (e) => {
    const reassignBtn = e.target.closest('.reassign-task-btn');
    if (!reassignBtn) return;

    // Lấy dữ liệu từ data-* của button
    const taskId = reassignBtn.dataset.taskId;
    const taskName = reassignBtn.dataset.taskName;
    const currentUser = reassignBtn.dataset.currentUser;
    const currentUserId = reassignBtn.dataset.currentUserId;

    // Điền vào modal
    document.getElementById('reassignTaskId').value = taskId;
    document.getElementById('reassignTaskName').value = taskName || '';
    document.getElementById('reassignCurrentUser').value = currentUser || '';

    // Reset form: new user, progress, reason
    const newUserInput = document.getElementById('reassignNewUser');
    const progressInput = document.getElementById('reassignProgress');
    const reasonInput = document.getElementById('reassignReason');

    newUserInput.innerHTML = '<option value="">-- Đang tải thành viên --</option>';
    newUserInput.disabled = true;
    progressInput.value = '';
    reasonInput.value = '';

    // Lấy danh sách user theo projectId (cần fetch từ server)
    const projectId = reassignBtn.dataset.projectId; // nếu bạn thêm data-project-id vào nút
    if (projectId) {
        try {
            const response = await fetch(`/Task/GetMembersByProject?projectId=${projectId}&userId=${currentUserId}`);
            if (!response.ok) throw new Error('Không thể load danh sách user');

            const users = await response.json();

            newUserInput.innerHTML = '<option value="">-- Chọn người mới --</option>';
            users.forEach(u => {
                const option = document.createElement('option');
                option.value = u.userId;
                option.textContent = u.userName;
                newUserInput.appendChild(option);
            });

            newUserInput.disabled = false;
        } catch (err) {
            console.error('❌ Lỗi load members:', err);
            newUserInput.innerHTML = '<option value="">-- Lỗi tải dữ liệu --</option>';
        }
    } else {
        newUserInput.innerHTML = '<option value="">-- Không có project --</option>';
    }

    // Hiển thị modal
    document.getElementById('reassignModal').classList.remove('hidden');
});
document.getElementById('closeReassignModal').addEventListener('click', () => {
    document.getElementById('reassignModal').classList.add('hidden');
});
document.getElementById('reassignForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const taskId = document.getElementById('reassignTaskId').value;
    const oldUserName = document.getElementById('reassignCurrentUser').value;
    const newUserId = document.getElementById('reassignNewUser').value;
    const progress = document.getElementById('reassignProgress').value;
    const reason = document.getElementById('reassignReason').value;

    if (!newUserId) {
        alert("Vui lòng chọn người mới.");
        return;
    }

    try {
        const res = await fetch('/Task/ReassignUser', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                taskId,
                newUserId,
                progress: Number(progress),
                reason
            })
        });

        if (!res.ok) throw new Error("Lỗi phía server");

        const data = await res.json();

        alert("Thay người thành công!");
        location.reload();

    } catch (err) {
        console.error(err);
        alert("Có lỗi xảy ra khi thay người.");
    }
});
// ==========================
// Load danh sách user khi chọn Project TRONG MODAL (chỉ cho CREATE)
// ==========================
document.addEventListener('DOMContentLoaded', () => {
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
    projectFilter.addEventListener('change', function () {
        const projectId = this.value;
        if (!projectId) {
            window.location.href = '/Task/Index';
        } else {
            window.location.href = `/Task/Index?projectId=${projectId}`;
        }
    });
});