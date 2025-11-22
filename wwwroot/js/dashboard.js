
/* =========================================== */
/* ============= STATE TOÀN CỤC ============== */
/* =========================================== */
// Các biến này lưu trữ dữ liệu "tĩnh"
// Chúng không thay đổi khi bạn lật trang
let currentProject = '';
//let allTasks = [];
let projectTaskCache = {};
let allProjectsList = [];
let allTasksStat = {};
let allProjectsStat = {};
let allDepartments = [];
let currentUser = {};
let currentUserRole = '';
let isProjectToggleAllOpen = false;
const PAGE_SIZE = 5;
const TASK_PAGE_SIZE = 3;
let currentViewMode = 'list';
let ganttChartInstance = null;
const viewTaskNull = `
  <div class="flex flex-col items-center justify-center py-8 bg-gray-900/80 rounded-xl border border-gray-700/50">
    <div class="p-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 shadow-md">
      <i data-lucide="folder-x" class="w-5 h-5 text-indigo-500"></i>
    </div>
    <span class="text-xs text-gray-400">Không có nhiệm vụ nào!</span>
  </div>
`;
/* =========================================== */
/* ============= HÀM TIỆN ÍCH ================ */
/* =========================================== */
/**
 * Hàm fetch an toàn (giữ nguyên từ code của bạn)
 */
async function safeFetchJson(url, defaultValue = []) {
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) {
        console.warn(`⚠️ Fetch lỗi: ${url}`, err);
        return defaultValue;
    }
}
/**
 * Hàm này chạy 1 callback sau khi DOM đã được cập nhật
 * (Rất quan trọng để khởi tạo Chart)
 */
function renderAfterDOMUpdate(callback) {
    requestAnimationFrame(callback);
}
function renderTaskCard(t) {
    let priorityBorder = "";
    switch (t.priority.toLowerCase()) {
        case "high": priorityBorder = "border-red-900"; break;
        default: priorityBorder = "border-gray-700"; break;
    }

    return `
        <div class="task-card border-l-[2px] ${priorityBorder} p-4 ml-4 md:ml-[50px] rounded-bl-[10px] transition transform duration-300"
            data-project-id="${t.projectId}"
            data-priority="${t.priority.toLowerCase()}">
            <div class="flex justify-between items-center">
                <h2 class="font-semibold text-white text-sm">
                    ${t.nameTask}
                </h2>
                <div class="relative group">
                    <button id="openUpdateTaskBtn#${t.projectId}#${t.idTask}"
                        onclick="this.blur()"
                        class="hidden p-2 rounded-full bg-gray-800 hover:bg-indigo-600 transition-all shadow-md hover:shadow-lg focus:outline-none focus:ring-0"
                        data-task='${JSON.stringify(t)}'>
                        <i data-lucide="bolt" class="w-4 h-4 text-gray-300"></i>
                    </button>
                </div>
            </div>
            <div class="flex items-center justify-between mb-6 mt-3 bg-gray-700/40 px-2 py-1 rounded-lg border border-gray-600">
                <div class="flex items-start gap-2 max-w-[70%]">
                    <i data-lucide="info" class="w-5 h-5 text-indigo-400"></i>
                    <p class="text-indigo-300 text-xs leading-relaxed">
                        <span class="font-semibold text-white">Mô tả công việc: </span>
                        <span>${t.note}</span>
                    </p>
                </div>
                <div class="flex items-center gap-2 relative">
                    <div class="relative group">
                        <button class="flex items-center gap-2 text-sm text-indigo-300 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-400/40 rounded-lg px-2 py-2 transition-all">
                            <i data-lucide='paperclip' class='w-4 h-4'></i>
                        </button>
                        <div class="absolute -top-0 z-100 right-0 -translate-x-1/3 bg-gray-900 text-white text-xs rounded-md px-2 py-1 opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 whitespace-nowrap shadow-lg">
                            <div class="flex justify-end gap-[35px] bg-gray-900">
                                <div class="relative group">
                                    <button class="flex items-center gap-2 text-xs text-indigo-300 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-400/40 rounded-lg px-3 py-1.5 transition-all"
                                            onclick="downloadFile('${t.fileNote}')"
                                            ${!t.fileNote || t.fileNote.trim() === "" ? "disabled" : ""}>
                                        <i data-lucide='download' class='w-3 h-3'></i>
                                    </button>
                                    <span class="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs rounded-md px-2 py-1 opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 whitespace-nowrap shadow-lg">
                                        Tải xuống
                                    </span>
                                </div>
                                <div class="relative group">
                                    <button class="flex items-center gap-2 text-xs text-indigo-300 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-400/40 rounded-lg px-3 py-1.5 transition-all"
                                            onclick="viewFile('${t.fileNote}')"
                                            ${!t.fileNote || t.fileNote.trim() === "" ? "disabled" : ""}>
                                        <i data-lucide='eye' class='w-3 h-3'></i>
                                    </button>
                                    <span class="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs rounded-md px-2 py-1 opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 whitespace-nowrap shadow-lg">
                                        Xem
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="flex flex-col md:flex-row md:justify-between md:items-center w-full gap-2 md:gap-0">
                <div class="flex flex-col md:flex-row md:justify-start gap-2 md:gap-3 items-start md:items-center text-sm text-gray-400">
                    <div class="flex flex-wrap gap-2">
                        ${renderLabel(t.statusName, t.overdue)}
                    </div>
                    <span class="text-gray-400 hidden md:inline">•</span>
                    <div class="relative group cursor-pointer text-xs">
                        <div class="flex gap-1 items-center">
                            <i data-lucide="circle-user-round" class="w-4 h-4 text-white"></i>
                            <span>${t.nameAssignee ?? "Chưa có"}</span>
                        </div>
                    </div>
                    <span class="text-gray-400 hidden md:inline">•</span>
                    <div class="flex items-center gap-2">
                        <div class="relative group cursor-pointer text-xs">
                            <div class="flex gap-1 items-center">
                                <i data-lucide="calendar" class="w-4 h-4 text-green-600"></i>
                                <span>${t.startDate ? new Date(t.startDate).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "--/--/----"}</span>
                            </div>
                        </div>
                        <span class="text-gray-400 hidden md:inline">•</span>
                        <div class="relative group cursor-pointer text-xs">
                            <div class="flex gap-1 items-center">
                                <i data-lucide="calendar-check" class="w-4 h-4 text-red-600"></i>
                                <span>${t.endDate ? new Date(t.endDate).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "--/--/----"}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}
function attachTaskButtonListeners(container) {
    // Chỉ tìm trong container vừa thêm
    container.querySelectorAll("[id^='openUpdateTaskBtn#']").forEach(btn => {
        if (btn.dataset.listenerAttached) return; // Tránh gán lặp
        btn.dataset.listenerAttached = true;

        btn.addEventListener("click", () => {
            const taskData = btn.getAttribute("data-task");
            if (taskData) {
                const task = JSON.parse(taskData);
                openTaskModal(task, currentUserRole); // `projects` không cần thiết nữa
            }
        });
    });
    lucide.createIcons(); // Gọi lại lucide để vẽ icon
}
async function loadTasksForProject(projectId, page) {
    const state = projectTaskCache[projectId] || { tasks: [], page: 0, totalPages: 1, isLoading: false };

    // 1. Kiểm tra điều kiện (đang tải, hết trang, trang 1 đã tải)
    if (state.isLoading) return;
    if (page > state.totalPages && state.totalPages > 0) return;
    // (Bỏ check trang 1 để cho phép reload)
    // if (page === 1 && state.tasks.length > 0) return; 

    // 2. Cập nhật state & bật loader
    state.isLoading = true;
    projectTaskCache[projectId] = state;
    const loader = document.getElementById(`loader-pj-${projectId}`);
    const container = document.querySelector(`.task-scroll-container[data-project-id="${projectId}"]`);

    if (!container) return; // Không tìm thấy container
    if (loader) loader.style.display = 'flex';

    // Nếu tải trang 1, xóa task cũ đi
    if (page === 1) {
        container.innerHTML = '';
    }

    // 3. Gọi API mới
    try {
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        //const data = await safeFetchJson(`/api/projects/${projectId}/tasks?pageIndex=${page}&pageSize=${TASK_PAGE_SIZE}`);
        const [data] = await Promise.all([
            safeFetchJson(`/api/projects/${projectId}/tasks?pageIndex=${page}&pageSize=${TASK_PAGE_SIZE}`),
            delay(1000) // Chờ 1000ms (1 giây)
        ]);

        if (data && data.items) {
            //console.log("Task: ", data);
            // 4. Render HTML mới
            let newTasksHtml = '';
            data.items.forEach(t => {
                newTasksHtml += renderTaskCard(t); // Dùng hàm helper
            });

            // Nối HTML vào container
            container.insertAdjacentHTML('beforeend', newTasksHtml);

            // 5. Cập nhật cache
            state.tasks = (page === 1) ? data.items : [...state.tasks, ...data.items];
            state.page = data.pageIndex;
            state.totalPages = data.totalPages;

            // 6. Gắn event cho các nút task MỚI
            attachTaskButtonListeners(container);

            // 7. Xử lý view rỗng
            if (state.tasks.length === 0) {
                container.innerHTML = viewTaskNull;
            }
        }
    } catch (err) {
        console.error(`❌ Lỗi tải task cho project ${projectId}:`, err);
    } finally {
        // 8. Cập nhật state & tắt loader
        state.isLoading = false;
        projectTaskCache[projectId] = state;
        if (loader) loader.style.display = 'none';
    }
    lucide.createIcons();
}
/* =========================================== */
/* ============ HÀM RENDER CHÍNH ============= */
/* =========================================== */
/**
 * Hàm này chịu trách nhiệm vẽ lại TOÀN BỘ giao diện
 * Nó sử dụng state toàn cục (allTasks, allTasksStat, ...)
 * và dữ liệu 'projects' (đã phân trang) được truyền vào.
 */
function renderDashboard(projects) {
    const container = document.getElementById("projectContainer");
    if (!container) {
        console.error("FATAL: Không tìm thấy #projectContainer!");
        return;
    }

    // --- Lấy dữ liệu từ state toàn cục ---
    const role = currentUserRole;
    //const tasks = allTasks;
    const tasksStat = allTasksStat;
    const projectsStat = allProjectsStat;
    // const me = currentUser;

    /*
     ***************************************
     ****************| Card |***************
     ***************************************
     */
    // ---| Lấy dữ liệu cho card (từ state toàn cục) |---
    let countProject = projects.totalCount || 0;
    let countProjectDone = projectsStat.completed || 0;
    let countTask = tasksStat.totalTasks || 0;
    let countTaskDone = tasksStat.completedTasks || 0;
    let countTaskInProgress = tasksStat.inProgressTasks || 0;
    let countTaskTodo = tasksStat.todoTasks || 0;
    let countTaskOverDue = tasksStat.overdueTasks || 0;

    let countToDo = projectsStat.todo || 0;
    let countInProgress = projectsStat.inProgress || 0;
    let countDone = projectsStat.completed || 0;
    let countOverdue = projectsStat.overdue || 0;

    // --- UI CARDS ---
    const card1 = `
        <!-- Card 1 -->
        <div class="font-mono tracking-wide bg-gray-900 border-t-4 border-indigo-500 rounded-xl shadow-md p-3 hover:shadow-indigo-500/30 transition transform hover:-translate-y-0.5 duration-300 opacity-0 animate-cardFadeIn delay-[25ms]">
            <div class="flex items-center justify-between">
                <div class="p-2.5 rounded-full bg-indigo-600/20 text-indigo-400">
                    <i data-lucide="folder-open-dot" class="w-4 h-4"></i>
                </div>
                <p id="tongduan" class="text-2xl font-bold text-white">${countProject}</p>
            </div>
            <h3 class="mt-2 text-gray-200 font-semibold text-sm">TỔNG DỰ ÁN</h3>
            <ul class="mt-1.5 text-xs text-gray-400 space-y-0.5">
                <li>• Hoàn thành: <span id="duanhoanthanh" class="text-gray-300 font-medium">${countProjectDone}</span></li>
                <li>• Tỷ lệ: <span id="duanhoanthanhpro" class="text-indigo-400 font-medium">
                    ${(countProject == 0 ? 0 : (countProjectDone / countProject) * 100).toFixed(2)}%
                </span></li>
            </ul>
        </div>
    `;
    const card2 = `
        <!-- Card 2 -->
        <div class="font-mono tracking-wide bg-gray-900 border-t-4 border-green-500 rounded-xl shadow-md p-3 hover:shadow-green-500/30 transition transform hover:-translate-y-0.5 duration-300 opacity-0 animate-cardFadeIn delay-[50ms]">
            <div class="flex items-center justify-between">
                <div class="p-2.5 rounded-full bg-green-600/20 text-green-400">
                    <i data-lucide="list-checks" class="w-4 h-4"></i>
                </div>
                <p id="tongnhiemvu" class="text-2xl font-bold text-white">${countTask}</p>
            </div>
            <h3 class="mt-2 text-gray-200 font-semibold text-sm">TỔNG NHIỆM VỤ</h3>
            <ul class="mt-1.5 text-xs text-gray-400 space-y-0.5">
                <li>• Hoàn thành: <span id="nhiemvuhoanthanh" class="text-gray-300 font-medium">${countTaskDone}</span></li>
                <li>• Tỷ lệ: <span id="nhiemvuhoanthanhpro" class="text-green-400 font-medium">
                    ${(countTask == 0 ? 0 : (countTaskDone / countTask) * 100).toFixed(2)}%
                </span></li>
            </ul>
        </div>
    `;
    const card3 = `
        <!-- Card 3 -->
        <div class="font-mono tracking-wide bg-gray-900 border-t-4 border-yellow-400 rounded-xl shadow-md p-3 hover:shadow-yellow-400/30 transition transform hover:-translate-y-0.5 duration-300 opacity-0 animate-cardFadeIn delay-[75ms]">
            <div class="flex items-center justify-between">
                <div class="p-2.5 rounded-full bg-yellow-500/20 text-yellow-400">
                    <i data-lucide="hourglass" class="w-4 h-4"></i>
                </div>
                <p id="nhiemvudanglam" class="text-2xl font-bold text-white">${countTaskInProgress}</p>
            </div>
            <h3 class="mt-2 text-gray-200 font-semibold text-sm">NHIỆM VỤ ĐANG LÀM</h3>
            <ul class="mt-1.5 text-xs text-gray-400 space-y-0.5">
                <li>• Chưa bắt đầu: <span id="nhiemvuchuabd" class="text-gray-300 font-medium">${countTaskTodo}</span></li>
            </ul>
        </div>
    `;
    const card4 = `
        <!-- Card 4 -->
        <div class="font-mono tracking-wide bg-gray-900 border-t-4 border-red-500 rounded-xl shadow-md p-3 hover:shadow-red-500/30 transition transform hover:-translate-y-0.5 duration-300 opacity-0 animate-cardFadeIn delay-[100ms]">
            <div class="flex items-center justify-between">
                <div class="p-2.5 rounded-full bg-red-600/20 text-red-400">
                    <i data-lucide="alert-triangle" class="w-4 h-4"></i>
                </div>
                <p id="nhiemvuquahan" class="text-2xl font-bold text-white">${countTaskOverDue}</p>
            </div>
            <h3 class="mt-2 text-gray-200 font-semibold text-sm">NHIỆM VỤ QUÁ HẠN</h3>
            <ul class="mt-1.5 text-xs text-gray-400 space-y-0.5">
                <li>• Tỷ lệ: <span id="nhiemvuquahanpro" class="text-red-400 font-medium">
                    ${(countTask == 0 ? 0 : (countTaskOverDue / countTask) * 100).toFixed(2)}%
                </span></li>
            </ul>
        </div>
    `;
    /*
     ***************************************
     **************| MAIN VIEW |************
     ***************************************
    */
    // --- LEFT COLUMN ---
    const x = -1;
    const y = -1;

    // QUAN TRỌNG: Cập nhật pageIndex/totalPages từ object 'projects' được truyền vào
    const controllButton = `
        <div class="flex flex-col md:flex-row md:items-center md:justify-between mb-3 gap-4 md:gap-0">
            <div class="flex items-center justify-center md:justify-start gap-3">
                <button id="prevPage"
                    class="flex items-center justify-center w-9 h-9 rounded-lg bg-gray-800 text-gray-300 hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                    <i data-lucide="chevron-left" class="w-4 h-4"></i>
                </button>

                <span id="pageIndicator" class="text-xs font-medium text-gray-200 select-none">
                    Trang <span id="currentPage">${projects.pageIndex || 1}</span>/<span id="totalPages">${projects.totalPages || 1}</span>
                </span>
                <button id="nextPage"
                    class="flex items-center justify-center w-9 h-9 rounded-lg bg-gray-800 text-gray-300 hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                    <i data-lucide="chevron-right" class="w-4 h-4"></i>
                </button>
            </div>

            <div class="flex items-center justify-between gap-3">
                <button id="toggleAllBtn"
                    class="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-3 py-2 rounded-lg shadow-sm transition-all w-full md:w-auto">
                    <i data-lucide="chevron-up" class="w-4 h-4"></i>
                    Thu gọn tất cả
                </button>

                <div class="hidden md:flex items-center bg-gray-800 rounded-lg p-1 gap-1">
                    <button data-view="list" title="Xem dạng danh sách"
                        class="view-toggle-btn flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${currentViewMode === 'list' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'}">
                        <i data-lucide="layout-list" class="w-4 h-4"></i>
                    </button>
                    <button data-view="gantt" title="Xem dạng Gantt"
                        class="view-toggle-btn flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${currentViewMode === 'gantt' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'}">
                        <i data-lucide="gantt-chart-square" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
         </div>
        `;
    const viewProjectNull = `
        <div class="text-center py-10 text-gray-400 text-lg bg-gray-900/50 rounded-lg flex flex-col items-center justify-center gap-3">
            <i data-lucide="folder-x" class="w-[80px] h-[80px] text-gray-500"></i>
            <span>Hiện chưa có dự án nào.</span>
        </div>
    `;

    let viewProject = ``;
    let projectCover = ``;

    // Chỉ lặp qua 'projects.items' (dữ liệu của trang hiện tại)
    if (projects.items && projects.items.length > 0) {
        projects.items.forEach(p => {
            projectCover = `
                <div class="flex justify-between items-center p-4 gap-[20px] cursor-pointer hover:bg-gray-700 transition"
                    data-toggle="project#${p.idProject}">
                    <div class="w-full">
                        <div class="flex items-center justify-between w-full gap-[20px]">
                            <div class="flex items-center gap-[5px]">
                                <i data-lucide="chevron-down" class="w-5 h-5 text-gray-400 transition-transform duration-300"></i>
                                <h3 class="font-semibold text-md text-white">
                                    ${p.projectName}
                                </h3>
                            </div>
                            <div class="${p.status === 3 ? "" : "hidden"}">
                                <i data-lucide="circle-check-big" class="w-9 h-9" style="color: #00ff88;"></i>
                            </div>
                            <div class="${p.status !== 3 && p.totalTasks !== 0 ? "" : "hidden"}">
                                <i data-lucide="hourglass" class="w-9 h-9" style="color: orange;"></i>
                            </div>
                        </div>
                        <div class="w-full mt-5 flex flex-col md:flex-row md:items-center gap-3">
                            <!-- Manager -->
                            <div class="flex gap-1 items-center bg-gray-700/50 px-4 py-1.5 rounded-full whitespace-nowrap">
                                <i data-lucide="circle-user-round" class="w-4 h-4 text-white"></i>
                                <span class="text-xs">${p.manager ?? "Unknown"}</span>
                            </div>

                            <!-- Thời gian (Start + End) -->
                            <div class="w-full flex flex-row items-center justify-start md:justify-start gap-3">
                                <div class="flex gap-1 items-center bg-green-900/50 px-4 py-1.5 rounded-full">
                                    <i data-lucide="calendar" class="w-4 h-4 text-white"></i>
                                    <span class="text-xs">
                                        ${p.startDay ? new Date(p.startDay).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "--/--/----"}
                                    </span>
                                </div>

                                <div class="flex gap-1 items-center bg-red-900/50 px-4 py-1.5 rounded-full">
                                    <i data-lucide="calendar-check" class="w-4 h-4 text-white"></i>
                                    <span class="text-xs">
                                        ${p.endDay ? new Date(p.endDay).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "--/--/----"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            console.log();
            
            let taskListView = '';
            if (p.totalTasks == 0) {
                // Nếu project không có task, hiển thị "viewTaskNull"
                taskListView = viewTaskNull;
            }

            viewProject += `
                <div class="project-container bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
                    ${projectCover}
                    <div id="project#${p.idProject}" class="overflow-hidden transition-all duration-500 ease-in-out">
                        <div class="p-4 border-t border-gray-700 bg-gray-900/60">
                            <div class="mb-4 p-3 rounded-lg bg-gradient-to-r from-indigo-600/20 to-purple-600/10">
                                <div class="flex items-center justify-between mb-1">
                                    <h4 class="text-white text-sm font-semibold flex items-center gap-2">
                                        <i data-lucide="file-text" class="w-4 h-4 text-indigo-400"></i>
                                        Mô tả dự án
                                    </h4>
                                    <!--
                                    <div class="flex items-center gap-2 relative">
                                        ${p.fileNote && p.fileNote.trim() !== ""
                                            ? `
                                                <button class="flex items-center gap-2 text-xs text-indigo-300 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-400/40 rounded-lg px-3 py-1.5 transition-all"
                                                        onclick="downloadFile('${p.fileNote}')">
                                                    <i data-lucide='download' class='w-3 h-3'></i>
                                                    Tải xuống
                                                </button>

                                                <button class="flex items-center gap-2 text-xs text-indigo-300 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-400/40 rounded-lg px-3 py-1.5 transition-all"
                                                        onclick="viewFile('${p.fileNote}')">
                                                    <i data-lucide='eye' class='w-3 h-3'></i>
                                                    Xem
                                                </button>
                                            `
                                            : ""}
                            
                                        <button id="addFileBtn#${p.idProject}" disabled data-project="${p.idProject}" class="flex items-center gap-2 text-xs text-green-300 bg-green-600/20 hover:bg-green-600/40 border border-green-400/40 rounded-lg px-3 py-1.5 transition-all">
                                            <i data-lucide='plus' class='w-3 h-3'></i>
                                            Thêm file
                                        </button>
                                    </div>
                                    -->
                                </div>

                                <p class="text-gray-300 text-sm leading-relaxed">
                                    ${p.note}
                                </p>
                            </div>

                            <div class="max-h-[420px] overflow-y-auto overflow-x-hidden scroll-smooth task-scroll-container custom-scroll"
                                data-project-id="${p.idProject}">
                                ${taskListView}
                            </div>

                            <!-- Loader -->
                            <div id="loader-pj-${p.idProject}" 
                                 class="task-loader w-full flex justify-center items-center gap-2 py-3 text-gray-400 text-xs transition-all duration-300"
                                 style="display: none;">
                                <svg class="animate-spin w-4 h-4 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle class="opacity-25" cx="12" cy="12" r="10"
                                            stroke="currentColor" stroke-width="4"></circle>
                                    <path class="opacity-75" fill="currentColor"
                                          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                                </svg>
                                <span>Đang tải thêm...</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
    }

    let viewProjectContainer = ``;
    // Sửa điều kiện: Kiểm tra 'projects.items'
    if (!projects.items || projects.items.length === 0) {
        viewProjectContainer += viewProjectNull;
    } else {
        viewProjectContainer += viewProject;
    }

    let mainViewContent = '';
    if (currentViewMode === 'list') {
        // Nếu là view "list", dùng code cũ của bạn
        mainViewContent = `
            <div class="space-y-4 max-h-[630px] overflow-y-auto custom-scroll">
                ${viewProjectContainer}
            </div>
        `;
    } else {
        // Nếu là view "gantt", hiển thị placeholder
        mainViewContent = `
            <div id="project-gantt-view" class="space-y-4 max-h-[630px] overflow-y-auto overflow-x-hidden custom-scroll">
                <div class="text-center py-10 text-gray-400 text-lg bg-gray-900/50 rounded-lg">
                    <i data-lucide="gantt-chart-square" class="w-16 h-16 text-gray-500 mx-auto mb-3"></i>
                    Chức năng Gantt Chart đang được phát triển.
                    <p class="text-xs mt-2">Dạng xem này sẽ hiển thị các dự án và task trên một dòng thời gian.</p>
                </div>
            </div>
        `;
    }

    const leftColumn = `
        <div class="lg:col-span-2 bg-gradient-to-b from-gray-900 to-gray-800 rounded-2xl shadow-lg p-4">
            <div class="flex flex-col md:flex-row md:justify-between md:items-center mb-4 gap-4 md:gap-0">
                <h2 class="text-md font-semibold text-white">Dự án & Nhiệm vụ</h2>
                <div class="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                    <div class="relative flex items-center">
                        <input type="text" id="searchInput"
                                placeholder="Tìm kiếm..."
                                class="bg-gray-800 text-white text-xs pl-9 pr-3 py-2 rounded-lg border border-gray-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 outline-none transition w-full md:w-60" />
                        <i data-lucide="search"
                            class="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"></i>
                    </div>
                    <button id="openUpdateProjectBtnAdd#${y}#${y}" disabled class="${role == "ADMIN" ? "" : "hidden"} hidden bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-medium transition flex items-center gap-1">
                        <i data-lucide="folder-plus" class="w-4 h-4"></i> Thêm dự án
                    </button>
                    
                    <button id="openUpdateTaskBtn#${x}#${x}" class="hidden bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-xs font-medium transition flex items-center gap-1">
                        <i data-lucide="list-plus" class="w-4 h-4"></i> Thêm nhiệm vụ
                    </button>
                </div>
            </div>

            <hr class="border-t border-gray-700 my-4" />

            <div class="space-y-4">
                ${controllButton}
            </div>
            <div id="project-list-view" class="space-y-4 mt-[20px] max-h-[630px] overflow-y-auto custom-scroll ${currentViewMode === 'list' ? '' : 'hidden'}">
                ${viewProjectContainer}
            </div>

            <div id="project-gantt-view" class="space-y-4 mt-[20px] max-h-[630px] overflow-y-auto custom-scroll ${currentViewMode === 'gantt' ? '' : 'hidden'}">
                <div id="gantt-chart-container" class="gantt-target"></div>
                <div id="gantt-placeholder" class="flex flex-col items-center justify-center text-center py-10 text-white">
                    <i data-lucide="gantt-chart-square" class="w-16 h-16"></i>
                    <span>Bấm nút Gantt để xây dựng biểu đồ...</span>
                </div>

                <!--
                <div class="flex flex-col items-center justify-center text-center py-10 text-gray-400 text-lg bg-gray-900/50 rounded-lg">
                    <i data-lucide="gantt-chart-square" class="w-16 h-16 text-gray-500 mx-auto mb-3"></i>
                    <span>Chức năng Gantt Chart đang được phát triển.</span>
                    <p class="text-xs mt-2">Dạng xem này sẽ hiển thị các dự án và task trên một dòng thời gian.</p>
                </div>
                -->
            </div>
        </div>
    `;

    // =====================================================================
    // --- RIGHT COLUMN ---
    let notStarted = countTaskTodo;
    let inProgress = countTaskInProgress;
    let completed = countTaskDone;
    let overdue = countTaskOverDue;

    // QUAN TRỌNG: Logic Chart phải chạy SAU KHI render DOM
    // Sử dụng hàm helper 'renderAfterDOMUpdate'
    renderAfterDOMUpdate(() => {
        // (Kiểm tra xem ChartJS và datalabels plugin đã được tải chưa)
        if (typeof Chart === 'undefined' || typeof ChartDataLabels === 'undefined') {
            console.error("Chart.js hoặc ChartDataLabels chưa được tải!");
            return;
        }

        const ctx1El = document.getElementById("statusChart");
        if (ctx1El) {
            const ctx1 = ctx1El.getContext("2d");
            new Chart(ctx1, {
                type: "doughnut",
                data: {
                    labels: ["Chưa triển khai", "Đang thực hiện", "Hoàn thành", "Quá hạn"],
                    datasets: [
                        {
                            data: [notStarted, inProgress, completed, overdue],
                            backgroundColor: ["#333", "#3b82f6", "#22c55e", "#ef4444"],
                            borderWidth: 0,
                        },
                    ],
                },
                options: {
                    cutout: "50%",
                    plugins: {
                        legend: {
                            position: "bottom",
                            labels: {
                                color: "#d1d5db",
                                boxWidth: 12,
                                padding: 15,
                            },
                        },
                        datalabels: {
                            color: "#fff",
                            font: {
                                size: 14,
                                weight: "bold",
                            },
                            formatter: (value, ctx) => {
                                const dataArr = ctx.chart.data.datasets[0].data;
                                const sum = dataArr.reduce((a, b) => a + b, 0);

                                // ✅ Nếu tổng = 0 → không hiển thị %
                                if (sum === 0 || value === 0) return "";
                                const percentage = ((value / sum) * 100).toFixed(1) + "%";
                                return percentage;
                            },
                        },
                    },
                },
                plugins: [
                    ChartDataLabels,
                    {
                        id: "centerText",
                        beforeDraw: (chart) => {
                            const { width, height, ctx } = chart;
                            ctx.restore();
                            const total = chart.data.datasets[0].data.reduce((a, b) => a + b, 0);

                            ctx.font = "bold 16px sans-serif";
                            ctx.fillStyle = "#e5e7eb";
                            ctx.textBaseline = "middle";
                            ctx.textAlign = "center";

                            const content = document.getElementById("TaskStatusProgress");

                            // ✅ Nếu tất cả bằng 0 → hiện chữ khác
                            if (total === 0) {
                                ctx.fillText("Không có dữ liệu", width / 2, height / 2.2);
                            }
                            if (content) {
                                content.textContent = `Trạng thái nhiệm vụ`;
                            }
                            ctx.save();
                        },
                    },
                ],
            });
        } // hết if (ctx1El)

        const ctx2El = document.getElementById("progressChart");
        if (ctx2El) {
            const ctx2 = ctx2El.getContext("2d");
            new Chart(ctx2, {
                type: "bar",
                data: {
                    labels: ["ToDo", "InProgress", "Done", "Overdue"],
                    datasets: [{
                        label: "Số lượng dự án",
                        data: [
                            countToDo,
                            countInProgress,
                            countDone,
                            countOverdue,
                        ],
                        backgroundColor: [
                            "#eab308", // ToDo
                            "#3b82f6", // InProgress
                            "#22c55e", // Done
                            "#ef4444", // Overdue
                        ],
                        borderRadius: 6,
                    }]
                },
                options: {
                    indexAxis: "x",
                    scales: {
                        x: {
                            title: { display: true, text: "Trạng thái", color: "#d1d5db" },
                            ticks: { color: "#9ca3af" },
                            grid: { color: "#1f2937" },
                        },
                        y: {
                            title: { display: true, text: "Số lượng dự án", color: "#d1d5db" },
                            ticks: { color: "#9ca3af", stepSize: 1 },
                            grid: { color: "#1f2937" },
                            beginAtZero: true
                        }
                    },
                    plugins: {
                        legend: { labels: { color: "#d1d5db" } },
                        tooltip: {
                            callbacks: {
                                label: function (context) {
                                    return ` ${context.dataset.label}: ${context.formattedValue}`;
                                }
                            }
                        }
                    },
                },
            });
        } // hết if (ctx2El)
    }); // hết renderAfterDOMUpdate
    // ------------------------------------------------------------------
    const chart1 = `
        <div class="bg-gradient-to-b from-gray-900 to-gray-800 rounded-2xl shadow-lg p-6">
            <h3 class="text-lg font-semibold text-white mb-4" id="TaskStatusProgress">Trạng thái nhiệm vụ</h3>
            <canvas id="statusChart" height="200"></canvas>
        </div>
    `;
    const chart2 = `
        <div class="bg-gradient-to-b from-gray-900 to-gray-800 rounded-2xl shadow-lg p-6">
            <h3 class="text-lg font-semibold text-white mb-4">Phân bố tiến độ dự án</h3>
            <canvas id="progressChart" height="200"></canvas>
        </div>
    `;
    // ------------------------------------------------------------------
    const rightColumn = `
        <div class="space-y-6">
            ${chart1}
            ${role == "EMPLOYEE" ? `` : chart2}
        </div>
    `;
    /*
     ***************************************
     ***********| RENDER TO DOM |***********
     ***************************************
    */
    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
            ${role == "EMPLOYEE" ? `` : card1}
            ${card2}
            ${card3}
            ${card4}
        </div>

        <div class="flex flex-col items-center gap-4 h-[fit-content]">
            <div id="assignee-gantt-container" class="w-full bg-gray-800 rounded-2xl shadow-lg border border-gray-700 p-4 relative min-h-[400px] overflow-hidden">
                
                <div class="flex justify-between items-center mb-4">
                    <div class="flex items-center gap-3">
                        <h3 class="text-lg font-semibold text-white flex items-center gap-2">
                            <i data-lucide="users" class="w-5 h-5 text-indigo-400"></i>
                            Tiến độ theo nhân sự
                        </h3>
                        <select id="gantt-department-filter"
                            class="${role == "ADMIN" ? "" : "hidden"} bg-gray-700 text-gray-300 text-xs rounded-lg px-3 py-1.5 border border-gray-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 outline-none transition mr-2">
                            <option value="all">Tất cả phòng ban</option>
                        </select>
                    </div>
                    <div>
                        <!-- Lọc theo phòng ban-->
                        <button id="gantt-check" class="p-1.5 rounded hover:bg-gray-600 text-gray-400 hover:text-white transition" title="Hiển thị chi tiết">
                            <i data-lucide="check-square" class="w-4 h-4 text-indigo-400"></i>
                        </button>
                        <button id="gantt-reload" class="p-1.5 rounded hover:bg-gray-600 text-gray-400 hover:text-white transition" title="Làm mới">
                            <i data-lucide="refresh-cw" class="w-4 h-4"></i>
                        </button>
                        <button id="gantt-expand" class="p-1.5 rounded hover:bg-gray-600 text-gray-400 hover:text-white transition" title="Mở rộng">
                            <i data-lucide="maximize-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>

                <div id="assignee-gantt-scroll-wrapper" class="max-h-[280px] overflow-y-auto custom-scroll pr-2">
                    <div id="assignee-gantt-chart"></div>
                </div>
                
                <div id="gantt-loader" class="absolute inset-0 flex flex-col items-center justify-center bg-gray-800/90 z-10">
                    <svg class="animate-spin w-8 h-8 text-indigo-500 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                    </svg>
                    <span class="text-gray-400 text-sm">Đang tải dữ liệu...</span>
                </div>
            </div>

            <div class="w-full font-mono tracking-wide grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-screen text-gray-200">
                ${leftColumn}
                ${rightColumn}
            </div>
        </div>
    `;

    /*
     ***************************************
     ********| POST-RENDER LOGIC |**********
     ***************************************
    */
    // 🟢 Phải gọi lại sau khi DOM đã có các icon mới
    lucide.createIcons();

    // 🟢 GỌI LẠI HÀM GẮN SỰ KIỆN
    // (Gắn event cho các nút, thanh search, v.v... MỚI)
    attachAllEventListeners(projects, role);

    // 🟢 GỌI LẠI HÀM KHỞI TẠO PAGINATION
    // (Gắn event cho nút Next/Prev MỚI)
    initPagination(projects);

    // --- THÊM DÒNG NÀY: Vẽ biểu đồ Gantt ---
    // Chờ 1 chút để DOM ổn định hoặc gọi trực tiếp
    renderAfterDOMUpdate(() => {
        // Gọi hàm vẽ chart
        // projects.items là danh sách dự án của trang hiện tại
        renderAssigneeGantt(projects.items);
    });
}

/**
 * Hàm này gom tất cả các event listener lại một chỗ
 * Nó sẽ được gọi lại MỖI KHI renderDashboard
 */
function attachAllEventListeners(projects, role) {
    // EVENT CLICK MODAL (cho các nút openUpdateTaskBtn)
    document.querySelectorAll("[id^='openUpdateTaskBtn#']").forEach(btn => {
        // (Kiểm tra xem đã gán chưa để tránh gán lặp - nếu cần)
         //if (btn.dataset.listenerAttached) return; 
         //btn.dataset.listenerAttached = true;

        btn.addEventListener("click", () => {
            const taskData = btn.getAttribute("data-task");
            if (taskData) {
                const task = JSON.parse(taskData);
                // Pass projects (trang hiện tại) và role (toàn cục)
                openTaskModal(task, role);
            } else {
                // Đây là nút "Thêm nhiệm vụ" (id="openUpdateTaskBtn#-1#-1")
                openTaskModal(null, role); // Pass null để modal biết là "thêm mới"
            }
        });
    });
    // EVENT SEARCH
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
        searchInput.addEventListener("input", function () {
            const keyword = this.value.toLowerCase();

            document.querySelectorAll(".project-container").forEach(projectBlock => {
                //const text = card.textContent.toLowerCase();
                //card.style.display = text.includes(keyword) ? "block" : "none";
                // 1. Lấy toàn bộ text của cả khối project (bao gồm title, tasks, v.v.)
                const text = projectBlock.textContent.toLowerCase();

                // 2. Ẩn/hiện CẢ KHỐI project đó
                projectBlock.style.display = text.includes(keyword) ? "block" : "none";
            });
        });
    }
    // CÁC HÀM LOGIC GẮN EVENT KHÁC
    toggleProject(projects); // Gắn lại sự kiện toggle
    //filterHighPrior(); // Gắn lại sự kiện filter

    initInfiniteScroll();

    document.querySelectorAll(".view-toggle-btn").forEach(btn => {
        // Clone để ngăn gán lặp
        const toggleAllBtn = document.getElementById("toggleAllBtn");
        const prevPage = document.getElementById("prevPage");
        const nextPage = document.getElementById("nextPage");
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener("click", () => {
            const newView = newBtn.dataset.view;
            if (newView === currentViewMode) {
                return; // Đã ở view này, không làm gì
            }

            // 1. Cập nhật state toàn cục
            currentViewMode = newView;
            //console.log(`Chuyển sang view: ${currentViewMode}`);

            // 2. Lấy các element
            const listView = document.getElementById('project-list-view');
            const ganttView = document.getElementById('project-gantt-view');
            const listBtn = document.querySelector('.view-toggle-btn[data-view="list"]');
            const ganttBtn = document.querySelector('.view-toggle-btn[data-view="gantt"]');

            // 3. Tắt/Mở các View (toggle class 'hidden')
            if (currentViewMode === 'list') {
                listView?.classList.remove('hidden');
                ganttView?.classList.add('hidden');
                toggleAllBtn.classList.remove("hidden");
                //prevPage.setAttribute("disabled");
                //nextPage.setAttribute("disabled");
                prevPage.disabled = false;
                nextPage.disabled = false;
            } else {
                listView?.classList.add('hidden');
                ganttView?.classList.remove('hidden');
                toggleAllBtn.classList.add("hidden");
                //prevPage.removeAttribute("disabled");
                //nextPage.removeAttribute("disabled");
                prevPage.disabled = true;
                nextPage.disabled = true;
                buildAndRenderGanttChart(projects.items);
            }

            // 4. Cập nhật style nút (toggle class active)
            listBtn?.classList.toggle('bg-indigo-600', currentViewMode === 'list');
            listBtn?.classList.toggle('text-white', currentViewMode === 'list');
            listBtn?.classList.toggle('shadow-sm', currentViewMode === 'list');
            listBtn?.classList.toggle('text-gray-400', currentViewMode !== 'list');

            ganttBtn?.classList.toggle('bg-indigo-600', currentViewMode === 'gantt');
            ganttBtn?.classList.toggle('text-white', currentViewMode === 'gantt');
            ganttBtn?.classList.toggle('shadow-sm', currentViewMode === 'gantt');
            ganttBtn?.classList.toggle('text-gray-400', currentViewMode !== 'gantt');

            // 5. KHÔNG GỌI renderDashboard() NỮA
        });
    });
}
/**
 * Khởi tạo listener 'scroll'
 */
function initInfiniteScroll() {
    const scrollContainers = document.querySelectorAll('.task-scroll-container');

    scrollContainers.forEach(container => {
        const newContainer = container.cloneNode(true);
        container.parentNode.replaceChild(newContainer, container);
        newContainer.addEventListener('scroll', handleTaskScroll);
    });
}
/**
 * Xử lý sự kiện scroll
 */
function handleTaskScroll(event) {
    const container = event.target;

    // Lấy ID dự án từ dataset
    const projectId = container.dataset.projectId;
    if (!projectId) return;

    // Lấy state từ cache
    const state = projectTaskCache[projectId];

    // Kiểm tra: Nếu không có state, đang tải, hoặc đã hết trang
    if (!state || state.isLoading) return;
    if (state.page >= state.totalPages) {
        // (Bạn có thể hiển thị "Đã tải hết task" ở đây)
        return;
    }

    // Kiểm tra xem đã cuộn gần đến đáy chưa
    const GẦN_ĐÁY = 100; // Cách đáy 100px
    if (container.scrollTop + container.clientHeight >= container.scrollHeight - GẦN_ĐÁY) {

        // Tải trang tiếp theo
        //console.log(`🌀 Tải task trang ${state.page + 1} cho project ${projectId}...`);
        loadTasksForProject(projectId, state.page + 1);
    }
}
/* =========================================== */
/* ================ HELPER =================== */
/* =========================================== */
let assigneeGanttChart = null;
let ganttExpandedUsers = new Set();
let currentDepartmentFilter = 'all';
/**
 * Vẽ biểu đồ Gantt theo nhân sự (Full chức năng: Accordion, Scroll, Toolbar, Colors, Tooltip)
 * @param {Array} projects - Danh sách dự án đang hiển thị ở trang hiện tại
 */
async function renderAssigneeGantt(projects) {
    const chartEl = document.querySelector("#assignee-gantt-chart");
    const loaderEl = document.querySelector("#gantt-loader");
    const deptSelect = document.getElementById("gantt-department-filter");
    let isLabelShown = true;

    if (!chartEl || !projects || projects.length === 0) {
        if (loaderEl) loaderEl.innerHTML = '<span class="text-gray-500">Không có dữ liệu dự án.</span>';
        return;
    }

    // 1. Hiển thị loader (chỉ khi init lần đầu hoặc reload)
    if (!assigneeGanttChart && loaderEl) loaderEl.classList.remove("hidden");

    try {
        if (deptSelect && deptSelect.options.length <= 1) {
            // Chỉ fetch nếu là ADMIN (hoặc logic tùy bạn)
            // Ở đây ta check nếu element không có class 'hidden' thì mới fetch
            if (!deptSelect.classList.contains("hidden")) {
                const depts = await safeFetchJson(`/api/departments/list`, []);
                depts.forEach(d => {
                    const option = document.createElement("option");
                    option.value = d.idDepartment;
                    option.textContent = d.departmentName;
                    deptSelect.appendChild(option);
                });

                // Gắn sự kiện Change
                deptSelect.addEventListener("change", async (e) => {
                    currentDepartmentFilter = e.target.value;
                    // Gọi lại hàm render để fetch lại task theo department mới
                    await renderAssigneeGantt(projects);
                });
            }
        }

        // 2. Fetch dữ liệu
        const url = `/api/tasks/all?pageIndex=1&pageSize=100&departmentId=${currentDepartmentFilter}`;
        const response = await safeFetchJson(url, { items: [] });
        const safeResponse = (response && typeof response === "object") ? response : { items: [] };
        const allTasks = Array.isArray(safeResponse.items) ? safeResponse.items : [];

        if (allTasks.length === 0) {
            if (loaderEl) loaderEl.classList.add("hidden");

            // Xóa chart cũ nếu có
            if (assigneeGanttChart) {
                assigneeGanttChart.destroy();
                assigneeGanttChart = null;
            }
            chartEl.innerHTML = "";
            chartEl.innerHTML = `
                <div class="flex flex-col items-center justify-center h-[280px] text-gray-500 border-2 border-dashed border-gray-700 rounded-xl bg-gray-800/30">
                    <div class="p-4 rounded-full bg-gray-800 mb-3 shadow-sm">
                        <i data-lucide="clipboard-list" class="w-10 h-10 text-indigo-400 opacity-80"></i>
                    </div>
                    <span class="font-medium">Chưa có nhiệm vụ nào</span>
                    <span class="text-xs text-gray-500 mt-1">Các dự án hiện tại chưa có task nào được tạo.</span>
                </div>`;
            lucide.createIcons();
            return; // Dừng hàm tại đây, không vẽ chart nữa
        } else {
            // Nếu có data thì clear nội dung cũ (thông báo rỗng) để vẽ chart
            // NHƯNG ĐỪNG XÓA NẾU ĐANG CÓ CHART (để tránh nháy)
            if (!assigneeGanttChart) chartEl.innerHTML = "";
        }

        // 3. Xử lý dữ liệu & Tính toán Min/Max Date
        const tasksByUser = {};
        let minDate = new Date().getTime();
        let maxDate = new Date().getTime();
        let hasData = false;

        allTasks.forEach(t => {
            hasData = true;
            const assignee = t.nameAssignee || "Chưa phân công";
            if (!tasksByUser[assignee]) tasksByUser[assignee] = [];

            let color = '#3B82F6'; // Default Blue
            if (assignee === "Chưa phân công") {
                color = '#6366F1'; // Indigo
            } else {
                if (t.statusName === 1) color = '#6B7280'; // Gray (Todo)
                if (t.statusName === 3) color = '#10B981'; // Green (Done)
                if (t.overdue) color = '#EF4444'; // Red (Overdue)
            }

            const startDateObj = new Date(t.startDate);
            const endDateObj = new Date(t.endDate);
            startDateObj.setHours(0, 0, 0, 0);
            endDateObj.setHours(23, 59, 59, 999); // Cuối ngày

            if (startDateObj.getTime() > endDateObj.getTime()) {
                endDateObj.setTime(startDateObj.getTime());
            }

            const start = startDateObj.getTime();
            const end = endDateObj.getTime();

            // Cập nhật Min/Max thực tế
            if (!hasData || start < minDate) minDate = start;
            if (!hasData || end > maxDate) maxDate = end;

            tasksByUser[assignee].push({
                userKey: assignee, // Key gốc cho logic expand
                x: assignee,
                y: [start, end],
                fillColor: color,
                meta: {
                    taskName: t.nameTask,
                    projectName: t.projectName,
                    status: t.statusName,
                    s: new Date(t.startDate),
                    e: new Date(t.endDate)
                }
            });
        });

        // Nếu không có task nào
        if (!hasData) {
            minDate = new Date().getTime();
            maxDate = new Date().getTime() + 86400000;
        }

        const bufferTime = 2 * 24 * 60 * 60 * 1000;
        const realMinDate = minDate - bufferTime;
        const realMaxDate = maxDate + bufferTime;

        // --- [VIEWPORT: Hiển thị tối đa 45 ngày, còn lại scroll] ---
        const VIEW_RANGE_DAYS = 16;
        const DAYS_BEFORE_TODAY = 2;
        const msInDay = 24 * 60 * 60 * 1000;
        const currentViewDuration = VIEW_RANGE_DAYS * msInDay;

        // Timestamp hôm nay reset về 00:00
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTS = today.getTime();
        const todayTime = today.getTime();

        // Tỉ lệ lệch trái (0.0 = trái hoàn toàn, 0.5 = giữa, 1.0 = phải)
        const LEFT_RATIO = 0.375; // <-- chỉnh ở đây nếu muốn lệch nhiều/ít hơn

        // Tính khoảng xem
        let viewMinDate = todayTime - (DAYS_BEFORE_TODAY * msInDay);
        let viewMaxDate = viewMinDate + (VIEW_RANGE_DAYS * msInDay);

        // Không cho vượt giới hạn thực tế
        //if (viewMinDate < realMinDate) {
        //    viewMinDate = realMinDate;
        //    viewMaxDate = realMinDate + currentViewDuration;
        //}

        //if (viewMaxDate > realMaxDate) {
        //    viewMaxDate = realMaxDate;
        //    viewMinDate = realMaxDate - currentViewDuration;
        //}

        //const viewMaxDate = Math.min(realMaxDate, realMinDate + currentViewDuration);

        // --- TÍNH SỐ NGÀY ĐỂ CHIA VẠCH (Dựa trên Viewport) ---
        const tickCount = VIEW_RANGE_DAYS; // Cố định số vạch hiển thị
        // -------------------------------------------------

        // Logic Sắp xếp
        let userKeys = Object.keys(tasksByUser);
        userKeys.sort((a, b) => {
            if (a === "Chưa phân công") return -1;
            if (b === "Chưa phân công") return 1;
            return a.localeCompare(b, 'vi', { sensitivity: 'base' });
        });

        // Logic Expand/Collapse
        const seriesData = [];
        const labelColors = [];
        let rowCount = 0;

        userKeys.forEach(user => {
            const tasks = tasksByUser[user];
            const isExpanded = ganttExpandedUsers.has(user);
            const mainColor = (user === "Chưa phân công") ? '#F43F5E' : '#E5E7EB';

            if (isExpanded) {
                tasks.forEach((task, index) => {
                    const t = { ...task };
                    t.x = `${user}__${index}`; // Key unique
                    seriesData.push(t);

                    if (index === 0) labelColors.push(mainColor);
                    else labelColors.push('#6B7280');
                    rowCount++;
                });
            } else {
                tasks.forEach(task => {
                    const t = { ...task };
                    t.x = user;
                    seriesData.push(t);
                });
                labelColors.push(mainColor);
                rowCount++;
            }
        });

        const dynamicHeight = Math.max(350, rowCount * 50);

        const options = {
            series: [{ name: 'Tasks', data: seriesData }],
            chart: {
                height: dynamicHeight,
                type: 'rangeBar',
                background: 'transparent',
                animations: { enabled: false },
                zoom: { enabled: true, type: 'x', autoScaleYaxis: false },
                toolbar: {
                    show: true,
                    autoSelected: 'pan',
                    tools: {
                        selection: false, zoom: false, zoomin: false, zoomout: false,
                        download: true,
                        pan: true,
                        reset: true
                    }
                },
                // EVENT CLICK EXPAND
                events: {
                    // 1. Logic Click Expand (Giữ nguyên)
                    dataPointSelection: function (event, chartContext, config) {
                        const dataPoint = config.w.config.series[config.seriesIndex].data[config.dataPointIndex];
                        const userKey = dataPoint.userKey;
                        if (userKey) {
                            if (ganttExpandedUsers.has(userKey)) ganttExpandedUsers.delete(userKey);
                            else ganttExpandedUsers.add(userKey);
                            renderAssigneeGantt(projects);
                        }
                    },

                    // 2. Logic Snap to Day (Đã thêm Debounce và Làm tròn)
                    scrolled: function (chartContext, { xaxis }) {
                        if (!xaxis) return;

                        // Xóa timeout cũ nếu người dùng vẫn đang kéo
                        if (chartContext.snapTimeout) {
                            clearTimeout(chartContext.snapTimeout);
                        }

                        // Đợi 100ms sau khi dừng kéo mới thực hiện Snap
                        chartContext.snapTimeout = setTimeout(() => {
                            const currentMin = xaxis.min;
                            const date = new Date(currentMin);

                            // SỬA: Logic làm tròn đến ngày GẦN NHẤT
                            // Nếu đã kéo qua 12h trưa -> tính sang ngày hôm sau
                            if (date.getHours() >= 12) {
                                date.setDate(date.getDate() + 1);
                            }
                            // Reset về 00:00:00
                            date.setHours(0, 0, 0, 0);
                            const snappedMin = date.getTime();

                            // Chỉ zoom nếu vị trí lệch đáng kể (> 1 phút)
                            if (Math.abs(currentMin - snappedMin) > 60000) {
                                const snappedMax = snappedMin + currentViewDuration;
                                chartContext.zoomX(snappedMin, snappedMax);
                            }
                        }, 100); // Độ trễ 100ms
                    }
                }
            },
            plotOptions: {
                bar: { horizontal: true, barHeight: '60%', rangeBarGroupRows: true, borderRadius: 4, borderRadiusApplication: 'around' }
            },
            dataLabels: {
                enabled: isLabelShown, textAnchor: 'middle',
                style: { colors: ['#fff'], fontSize: '11px', fontWeight: '600' },
                formatter: function (val, opt) {
                    return opt.w.config.series[opt.seriesIndex].data[opt.dataPointIndex].meta.taskName;
                }
            },
            stroke: { width: 1, colors: ['#fff'] },
            fill: { type: 'solid', opacity: 0.8 },
            annotations: {
                xaxis: [{
                    x: new Date().getTime(), strokeDashArray: 4, borderColor: '#F43F5E', borderWidth: 2,
                    label: { borderColor: '#F43F5E', style: { color: '#fff', background: '#F43F5E', fontSize: '12px', fontWeight: 'bold', padding: { left: 5, right: 5, top: 2, bottom: 2 } }, text: 'Hôm nay', position: 'top', offsetY: 5 }
                }]
            },
            xaxis: {
                type: 'datetime',
                min: viewMinDate,
                max: viewMaxDate,
                tickAmount: tickCount, // Cố định số vạch
                labels: {
                    rotate: -10,
                    rotateAlways: true,
                    offsetX: -33,
                    style: { colors: '#9CA3AF' },
                    datetimeUTC: false,
                    formatter: function (value) {
                        const date = new Date(value);
                        if (isNaN(date.getTime())) return value;
                        return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    }
                },
                axisBorder: { show: false },
                axisTicks: { show: true, color: '#374151' },
                tooltip: { enabled: false }
            },
            yaxis: {
                labels: {
                    align: 'left',
                    style: { colors: labelColors, fontSize: '13px', fontWeight: 600 },
                    offsetX: -40, minWidth: 180, maxWidth: 180,
                    formatter: function (value) {
                        const valStr = String(value);
                        if (valStr.includes('__')) {
                            const parts = valStr.split('__');
                            const user = parts[0];
                            const idx = parseInt(parts[1]);
                            if (idx === 0) return `[-] ${user}`;
                            return ``;
                        }
                        return `[+] ${valStr}`;
                    }
                }
            },
            grid: { borderColor: '#374151', xaxis: { lines: { show: true } }, yaxis: { lines: { show: true } }, strokeDashArray: 0 },
            theme: { mode: 'dark' },
            tooltip: {
                custom: function ({ series, seriesIndex, dataPointIndex, w }) {
                    const data = w.globals.initialSeries[seriesIndex].data[dataPointIndex];
                    const startStr = data.meta.s.toLocaleDateString('vi-VN');
                    const endStr = data.meta.e.toLocaleDateString('vi-VN');
                    return `
                        <div class="px-3 py-2 bg-gray-900 border border-gray-600 rounded shadow-lg z-50 text-left">
                            <div class="text-xs text-gray-400 mb-1 truncate max-w-[200px]">${data.meta.projectName}</div>
                            <div class="text-sm font-bold text-white mb-1">${data.meta.taskName}</div>
                            <div class="text-xs text-indigo-300 font-mono mt-1">📅 ${startStr} - ${endStr}</div>
                        </div>
                    `;
                }
            }
        };

        if (assigneeGanttChart) assigneeGanttChart.destroy();

        //chartEl.innerHTML = '';

        assigneeGanttChart = new ApexCharts(chartEl, options);

        assigneeGanttChart.render().then(() => {
            const chartContainer = document.querySelector("#assignee-gantt-chart");
            if (chartContainer) {
                chartContainer.addEventListener('wheel', function (e) { e.stopPropagation(); }, { capture: true });
                const canvas = chartContainer.querySelector('.apexcharts-canvas');
                if (canvas) {
                    canvas.style.cursor = 'grab';
                    const cssId = 'force-grabbing-cursor';
                    const style = document.createElement('style');
                    style.id = cssId;
                    style.innerHTML = `* { cursor: grabbing !important; user-select: none !important; }`;
                    canvas.addEventListener('mousedown', (e) => { canvas.style.cursor = 'grabbing'; if (!document.getElementById(cssId)) document.head.appendChild(style); e.preventDefault(); });
                    window.addEventListener('mouseup', () => { canvas.style.cursor = 'grab'; const existingStyle = document.getElementById(cssId); if (existingStyle) existingStyle.remove(); });
                }
            }
        });

        if (loaderEl) loaderEl.classList.add("hidden");
        setTimeout(() => lucide.createIcons(), 500);

        // --- EVENT LISTENERS (TOOLBAR) ---
        const reloadBtn = document.getElementById('gantt-reload');
        const expandBtn = document.getElementById('gantt-expand');
        const scrollWrapper = document.getElementById('assignee-gantt-scroll-wrapper');
        const checkBtn = document.getElementById('gantt-check');
        const ganttDepartmentFilter = document.getElementById('gantt-department-filter');

        if (checkBtn) {
            const newBtn = checkBtn.cloneNode(true);
            checkBtn.parentNode.replaceChild(newBtn, checkBtn);

            // Set icon ban đầu (nếu mặc định là tắt)
            newBtn.innerHTML = '<i data-lucide="check-square" class="w-4 h-4 text-indigo-400"></i>';

            newBtn.addEventListener('click', () => {
                // 1. Đổi trạng thái
                isLabelShown = !isLabelShown;

                // 2. Cập nhật Icon (Check hoặc Square)
                if (isLabelShown) {
                    newBtn.innerHTML = '<i data-lucide="check-square" class="w-4 h-4 text-indigo-400"></i>';
                    newBtn.classList.add("text-indigo-400"); // Thêm màu cho nút sáng lên
                } else {
                    newBtn.innerHTML = '<i data-lucide="square" class="w-4 h-4"></i>';
                    newBtn.classList.remove("text-indigo-400");
                }
                lucide.createIcons();

                // 3. Cập nhật Chart (Không cần render lại toàn bộ)
                if (assigneeGanttChart) {
                    assigneeGanttChart.updateOptions({
                        dataLabels: {
                            enabled: isLabelShown
                        }
                    });
                }
            });
        }

        if (reloadBtn) {
            const newBtn = reloadBtn.cloneNode(true);
            reloadBtn.parentNode.replaceChild(newBtn, reloadBtn);
            const icon = newBtn.querySelector("svg");
            if (icon) icon.classList.remove("animate-spin");
            newBtn.addEventListener('click', async () => {
                if (icon) icon.classList.add("animate-spin");
                // Xoá placeholder (nếu đang có)
                chartEl.innerHTML = "";

                // Xoá biểu đồ cũ (nếu có)
                //if (assigneeGanttChart) {
                //    assigneeGanttChart.destroy();
                //    assigneeGanttChart = null;
                //}
                await renderAssigneeGantt(projects);
            });
        }

        if (expandBtn && scrollWrapper) {
            const newBtn = expandBtn.cloneNode(true);
            expandBtn.parentNode.replaceChild(newBtn, expandBtn);
            let isGanttExpanded = scrollWrapper.classList.contains("max-h-[85vh]");
            newBtn.addEventListener('click', () => {
                isGanttExpanded = !isGanttExpanded;
                const icon = newBtn.querySelector("svg");
                if (isGanttExpanded) {
                    scrollWrapper.classList.remove("max-h-[280px]"); scrollWrapper.classList.add("max-h-[85vh]"); newBtn.setAttribute("title", "Thu gọn");
                    if (icon) { icon.remove(); newBtn.innerHTML = '<i data-lucide="minimize-2" class="w-4 h-4"></i>'; lucide.createIcons(); }
                } else {
                    scrollWrapper.classList.remove("max-h-[85vh]"); scrollWrapper.classList.add("max-h-[280px]"); newBtn.setAttribute("title", "Mở rộng");
                    if (icon) { icon.remove(); newBtn.innerHTML = '<i data-lucide="maximize-2" class="w-4 h-4"></i>'; lucide.createIcons(); }
                }
            });
        }

    } catch (e) {
        console.error("Lỗi vẽ Gantt Chart:", e);
        if (loaderEl) loaderEl.innerHTML = '<span class="text-red-500 text-sm">Lỗi tải dữ liệu biểu đồ.</span>';
    }
}
/**
 * Lấy dữ liệu và xây dựng biểu đồ Gantt (PHIÊN BẢN JIRA TIMELINE)
 */
async function buildAndRenderGanttChart(projects) {
    // 1. Nếu đã render rồi thì thôi
    if (ganttChartInstance) {
        ganttChartInstance.destroy();
        ganttChartInstance = null;
    }

    const ganttContainer = document.getElementById("gantt-chart-container");
    const ganttPlaceholder = document.getElementById("gantt-placeholder");

    if (!ganttContainer) return;

    // 2. Hiển thị loader
    ganttPlaceholder.style.display = 'block';
    ganttContainer.innerHTML = ''; // Xóa chart cũ
    ganttPlaceholder.innerHTML = `
        <div class="flex flex-col items-center justify-center text-center py-10 text-gray-400">
            <svg class="animate-spin w-8 h-8 text-indigo-400 mx-auto mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
            </svg>
            <span>Đang xây dựng biểu đồ Gantt...</span>
        </div>`;

    try {
        // 3. Gọi API (giữ nguyên)
        const apiCalls = projects.map(p =>
            safeFetchJson(`/api/projects/${p.idProject}/all-tasks`)
        );
        const allTaskLists = await Promise.all(apiCalls);

        // 4. "Dịch" dữ liệu sang định dạng Timeline của ApexCharts
        // series = [ { name: 'Tên Project', data: [ { x: 'Tên Task', y: [start, end] } ] } ]

        let ganttSeries = [];

        projects.forEach((project, index) => {
            const tasks = allTaskLists[index];
            let projectData = [];

            // 4.1. Thêm Project (Epic)
            // (Thanh này sẽ có màu riêng)
            projectData.push({
                x: project.projectName, // Tên trên trục Y
                y: [
                    new Date(project.startDay).getTime(),
                    new Date(project.endDay).getTime()
                ],
                // Chúng ta sẽ dùng mảng 'colors' bên dưới
                // fillColor: '#4338CA' 
            });

            // 4.2. Thêm các task con
            if (tasks.length > 0) {
                tasks.forEach(task => {
                    projectData.push({
                        x: `\u00A0\u00A0↳ ${task.nameTask}`, // Tên trên trục Y
                        y: [
                            new Date(task.startDate).getTime(),
                            new Date(task.endDate).getTime()
                        ],
                        // 'fillColor' sẽ được ghi đè bởi mảng 'colors'
                    });
                });
            }

            // 4.3. Thêm nhóm này vào series chính
            ganttSeries.push({
                name: project.projectName, // Tên này sẽ hiện ở Legend/Tooltip
                data: projectData
            });
        });

        // 5. Khởi tạo biểu đồ ApexCharts (với options kiểu Jira)
        ganttPlaceholder.style.display = 'none'; // Ẩn placeholder

        const options = {
            series: ganttSeries,
            chart: {
                type: 'rangeBar',
                height: 600,
                background: 'transparent',
                toolbar: {
                    show: true,
                    tools: {
                        download: '<i data-lucide="download" class="w-4 h-4 text-gray-400 hover:text-white"></i>',
                        selection: true,
                        zoom: true,
                        zoomin: '<i data-lucide="zoom-in" class="w-4 h-4 text-gray-400 hover:text-white"></i>',
                        zoomout: '<i data-lucide="zoom-out" class="w-4 h-4 text-gray-400 hover:text-white"></i>',
                        pan: '<i data-lucide="move" class="w-4 h-4 text-gray-400 hover:text-white"></i>',
                        reset: '<i data-lucide="home" class="w-4 h-4 text-gray-400 hover:text-white"></i>',
                    }
                }
            },
            plotOptions: {
                bar: {
                    horizontal: true,
                    borderRadius: 4,
                    // TẮT: Để tất cả task con có cùng màu với project
                    distributed: false,
                }
            },
            // TẮT: Ẩn chữ *trên* thanh bar
            dataLabels: {
                enabled: false,
            },
            // THÊM: Đường kẻ "Hôm nay"
            annotations: {
                xaxis: [
                    {
                        x: new Date().getTime(), // Mốc "Hôm nay"
                        strokeDashArray: 2,     // Nét đứt
                        borderColor: '#FF4560', // Màu đỏ
                        label: {
                            borderColor: '#FF4560',
                            style: { color: '#fff', background: '#FF4560' },
                            text: 'Hôm nay'
                        }
                    }
                ]
            },
            xaxis: {
                type: 'datetime', // Trục X là thời gian
                labels: {
                    style: { colors: '#9CA3AF' }
                },
                axisBorder: { show: false },
                axisTicks: { color: '#374151' }
            },
            // BẬT: Hiển thị danh sách project/task bên trái
            yaxis: {
                show: true,
                labels: {
                    align: 'left',  // Bắt buộc căn trái
                    offsetX: 0,
                    style: {
                        colors: '#E5E7EB', // Màu chữ
                        fontSize: '13px',
                        fontFamily: 'inherit'
                    },
                    // Cắt bớt tên nếu quá dài
                    maxWidth: 200,
                }
            },
            grid: {
                borderColor: '#374151',
                row: {
                    colors: ['transparent', 'rgba(128, 128, 128, 0.05)'],
                }
            },
            tooltip: {
                theme: 'dark',
                x: {
                    format: 'dd/MM/yyyy'
                }
            },
            // THÊM: Mảng màu cho từng Project (series)
            // ApexCharts sẽ tự động xoay vòng các màu này
            colors: ['#008FFB', '#00E396', '#FEB019', '#FF4560', '#775DD0', '#3F51B5', '#F9C80E']
        };

        ganttChartInstance = new ApexCharts(ganttContainer, options);
        ganttChartInstance.render();

        lucide.createIcons();

    } catch (err) {
        console.error("Lỗi xây dựng Gantt Chart:", err);
        ganttPlaceholder.style.display = 'block';
        ganttPlaceholder.innerHTML = `<span class="text-red-400">Lỗi khi tải dữ liệu Gantt.</span>`;
    }
}

/**
 * Xử lý bật/tắt accordion project (Code của BẠN - đã sửa lỗi)
 */
function toggleProject(projects) {
    // FIX: Đã xóa `setTimeout` vì nó không cần thiết khi được gọi từ `attachAllEventListeners`
    const toggleButtons = document.querySelectorAll("[data-toggle]");
    const toggleAllBtn = document.getElementById("toggleAllBtn");

    if (!toggleAllBtn || !toggleButtons.length) {
        // Nếu không có nút nào (ví dụ: trang không có project) thì không làm gì
        return;
    }

    // 🔹 Khởi tạo trạng thái ban đầu cho từng project
    toggleButtons.forEach(btn => {
        const targetId = btn.getAttribute("data-toggle");
        const content = document.getElementById(targetId);
        const icon = btn.querySelector("svg"); // Giả sử icon là SVG (từ Lucide)

        if (!content || !projects.items) return;

        // Tìm project tương ứng qua id
        const project = projects.items.find(p => `project#${p.idProject}` === targetId);
        if (!project) return;

        // 🔹 Nếu Done hoặc không có task → luôn thu gọn
        // 🔹 Ngược lại, thì tuân theo trạng thái "Thu/Mở tất cả"
        const shouldBeCollapsed = (project.status == 3 || project.totalTasks == 0);
        const isCurrentlyOpen = !shouldBeCollapsed && isProjectToggleAllOpen; // Phải tôn trọng state toàn cục!

        if (isCurrentlyOpen) {
            content.classList.remove("max-h-0");
            content.classList.add("max-h-[1000px]");
            btn.classList.add("open");
            if (icon) icon.style.transform = "rotate(0deg)";
        } else {
            content.classList.remove("max-h-[1000px]");
            content.classList.add("max-h-0");
            btn.classList.remove("open");
            if (icon) icon.style.transform = "rotate(-90deg)";
        }

        // 🔹 Gắn sự kiện toggle từng project
        // FIX: Clone nút để xóa listener cũ
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        const newIcon = newBtn.querySelector("svg"); // Phải lấy icon từ nút MỚI

        newBtn.addEventListener("click", () => {
            const isOpen = newBtn.classList.contains("open");

            if (isOpen) {
                content.classList.remove("max-h-[1000px]");
                content.classList.add("max-h-0");
                newBtn.classList.remove("open");
                if (newIcon) newIcon.style.transform = "rotate(-90deg)";
            } else {
                content.classList.remove("max-h-0");
                content.classList.add("max-h-[1000px]");
                newBtn.classList.add("open");
                if (newIcon) newIcon.style.transform = "rotate(0deg)";

                // Khi mở, kiểm tra và tải task
                const projectId = newBtn.getAttribute("data-toggle").split('#')[1];
                if (projectId) {
                    // Chỉ tải nếu cache rỗng (tải lần đầu)
                    if (!projectTaskCache[projectId] || projectTaskCache[projectId].tasks.length === 0) {
                        loadTasksForProject(projectId, 1); // Luôn tải trang 1
                    }
                }
            }
            if (newIcon) newIcon.style.setProperty("transition", "transform 0.3s ease");
        });
    });

    // 🔹 Nút “Thu gọn / Mở tất cả”
    // FIX: Clone nút để xóa listener cũ
    const newToggleAllBtn = toggleAllBtn.cloneNode(true);
    toggleAllBtn.parentNode.replaceChild(newToggleAllBtn, toggleAllBtn);

    // Cập nhật text + icon ban đầu dựa trên state toàn cục
    newToggleAllBtn.innerHTML = isProjectToggleAllOpen
        ? `<i data-lucide="chevron-up" class="w-4 h-4"></i> <span class="text-xs">Thu gọn tất cả</span>`
        : `<i data-lucide="chevron-down" class="w-4 h-4"></i> <span class="text-xs">Mở tất cả</span>`;
    lucide.createIcons();

    newToggleAllBtn.addEventListener("click", () => {
        // Lấy lại danh sách nút và content (vì chúng ta đang ở trong 1 closure)
        const allToggleButtons = document.querySelectorAll("[data-toggle]");

        allToggleButtons.forEach(btn => {
            const targetId = btn.getAttribute("data-toggle");
            const content = document.getElementById(targetId);
            const icon = btn.querySelector("svg");
            if (!content) return;

            // FIX: Dùng state toàn cục 'isProjectToggleAllOpen'
            if (isProjectToggleAllOpen) {
                // Thu lại tất cả
                content.classList.remove("max-h-[1000px]");
                content.classList.add("max-h-0");
                btn.classList.remove("open");
                if (icon) icon.style.transform = "rotate(-90deg)";
            } else {
                // Mở tất cả
                content.classList.remove("max-h-0");
                content.classList.add("max-h-[1000px]");
                btn.classList.add("open");
                if (icon) icon.style.transform = "rotate(0deg)";
            }
        });

        // FIX: Cập nhật state toàn cục
        isProjectToggleAllOpen = !isProjectToggleAllOpen;

        // Cập nhật icon + text cho nút tổng
        newToggleAllBtn.innerHTML = isProjectToggleAllOpen
            ? `<i data-lucide="chevron-up" class="w-4 h-4"></i> <span class="text-xs">Thu gọn tất cả</span>`
            : `<i data-lucide="chevron-down" class="w-4 h-4"></i> <span class="text-xs">Mở tất cả</span>`;

        lucide.createIcons();
    });
}
console.log();

/* =========================================== */
/* ============ HÀM TẢI DỮ LIỆU ============== */
/* =========================================== */
/**
 * Hàm này được gọi khi nhấn Next/Prev
 * Nó chỉ fetch project mới và GỌI LẠI RENDER
 */
async function loadPageData(page, pageSize = PAGE_SIZE) {
    //console.log(`🔄 Load dữ liệu trang: ${page}`);
    let loading = document.getElementById("loadingOverlay");

    if (ganttChartInstance) {
        ganttChartInstance.destroy(); // Dùng hàm .destroy() của ApexCharts
        ganttChartInstance = null;
    }

    try {
        // (Có thể thêm hiệu ứng loading ở đây)
        loading.classList.remove("hidden");
        // Chỉ fetch projects cho trang mới
        const newProjects = await safeFetchJson(`/api/projects?pageIndex=${page}&pageSize=${pageSize}`);

        if (newProjects && (newProjects.items || newProjects.items.length === 0)) {
            // Render lại toàn bộ UI với project mới
            // Dữ liệu allTasks, currentUser, ... vẫn giữ nguyên từ state toàn cục
            renderDashboard(newProjects);
        } else {
            console.error("❌ Dữ liệu project trang mới không hợp lệ:", newProjects);
        }
    } catch (e) {
        loading.classList.add("hidden");
        console.error("❌ Lỗi tải project:", e.message);
    }
    // (Tắt hiệu ứng loading ở đây)
    loading.classList.add("hidden");
}
/**
 * Hàm này được gọi SAU MỖI LẦN RENDER
 * để gắn sự kiện cho nút Next/Prev MỚI
 */
function initPagination(projects) {
    let currentPage = projects.pageIndex || 1;
    const totalPages = projects.totalPages || 1;
    const prevBtn = document.getElementById("prevPage");
    const nextBtn = document.getElementById("nextPage");
    const currentPageEl = document.getElementById("currentPage");
    const totalPagesEl = document.getElementById("totalPages");

    if (!prevBtn || !nextBtn || !currentPageEl || !totalPagesEl) {
        console.warn("⚠️ Phân trang chưa render trong DOM.");
        return;
    }

    totalPagesEl.textContent = totalPages;
    updatePageDisplay();

    function updatePageDisplay() {
        currentPageEl.textContent = currentPage;
        prevBtn.disabled = currentPage === 1;
        nextBtn.disabled = currentPage === totalPages;

        prevBtn.classList.toggle("opacity-50", currentPage === 1);
        prevBtn.classList.toggle("hover:bg-indigo-600", currentPage !== 1);

        nextBtn.classList.toggle("opacity-50", currentPage === totalPages);
        nextBtn.classList.toggle("hover:bg-indigo-600", currentPage !== totalPages);
    }

    // Gắn sự kiện cho nút MỚI
    // (Không cần clone/replace vì các nút cũ đã bị xóa bởi innerHTML)

    prevBtn.addEventListener("click", () => {
        if (currentPage > 1) {
            // KHÔNG cần currentPage-- hay updatePageDisplay()
            // Vì loadPageData sẽ fetch và renderDashboard sẽ tự cập nhật
            loadPageData(currentPage - 1); // Gọi hàm toàn cục
        }
    });

    nextBtn.addEventListener("click", () => {
        if (currentPage < totalPages) {
            loadPageData(currentPage + 1); // Gọi hàm toàn cục
        }
    });
}
/* =========================================== */
/* ============ ĐIỂM BẮT ĐẦU CHẠY ============ */
/* =========================================== */
document.addEventListener("DOMContentLoaded", async () => {
    const fullPageLoader = document.getElementById('loadingOverlay');
    fullPageLoader.classList.remove("hidden");
    const container = document.getElementById("projectContainer");
    if (!container) return;

    // Gán vào state toàn cục
    currentUserRole = container.dataset.role;
    //console.log("User Role:", currentUserRole);

    // --- Bước 1: Chỉ fetch thông tin user ---
    const me = await safeFetchJson("/api/user/me", null);
    currentUser = me; // Lưu vào state toàn cục

    // --- Bước 2: Kiểm tra User TRƯỚC KHI fetch phần còn lại ---
    if (!currentUser || currentUser == null) {
        console.warn("User không hợp lệ hoặc chưa đăng nhập. Đang chuyển hướng...");
        window.location.href = "/Error/403";
        return; // Dừng thực thi ngay lập tức
    }

    // Nếu user OK, log và tiếp tục
    console.log("User:", me);

    // --- Bước 3: Fetch các dữ liệu còn lại (vì user đã hợp lệ) ---
    let [initialProjects, tasksStat, projectsStat] = await Promise.all([
        safeFetchJson(`/api/projects?pageIndex=1&pageSize=${PAGE_SIZE}`, { items: [], pageIndex: 1, totalPages: 1 }), // Trang 1
        safeFetchJson("/api/tasks/statistics", {}),
        safeFetchJson("/api/projects/statistics", {}),
    ]);

    // --- Lưu nốt vào state toàn cục ---
    allTasksStat = tasksStat;
    allProjectsStat = projectsStat;

    // --- Log dữ liệu ban đầu (phần còn lại) ---
    //console.log("Projects (Trang 1): ", initialProjects);
    //console.log("Stats Task: ", tasksStat);
    //console.log("Stats Project: ", projectsStat);

    // --- Render giao diện LẦN ĐẦU TIÊN ---
    renderDashboard(initialProjects);

    //console.log("✅ Dữ liệu đã tải và render xong. Ẩn loader.");

    if (fullPageLoader) {
        setTimeout(() => {
            fullPageLoader.classList.add('hidden');
        }, 500);
    }
});

console.log();
// _____________________________________________________
// ===================|        |========================
// -------------------| HELPER |------------------------
// ===================|________|========================
// =====================================================

// Helper
async function fetchMemberByProject(idProject) {
    if (!idProject) {
        console.error("❌ Không có idProject để fetch members");
        return [];
    }

    try {
        const res = await fetch(`/api/projects/${idProject}/members`);
        if (!res.ok) {
            console.error("❌ Lỗi fetch members:", res.status);
            return [];
        }

        const members = await res.json();
        //console.log("Members:", members);
        return members;
    } catch (err) {
        console.error("❌ Fetch members error:", err);
        return [];
    }
}

function formTask(task = null, projects = [], members = [], role) {
    let renderOptionProject = ``;
    let startDate = "";
    let endDate = "";

    if (task) {
        startDate = task.startDate
            ? new Date(task.startDate).toLocaleDateString("en-CA")
            : "";
        endDate = task.endDate
            ? new Date(task.endDate).toLocaleDateString("en-CA")
            : "";
    }

    if (Array.isArray(projects)) {
        projects.forEach(p => {
            renderOptionProject += `
                <option value="${p.idProject}" ${task && p.idProject == task.projectId ? "selected" : ""}>
                    ${p.projectName}
                </option>
            `;
        });
    }

    const assigneeDisabled = (task === null || role === "EMPLOYEE") ? "disabled" : "";

    return (`
        <div id="updateTaskModal" class="fixed inset-0 flex items-center justify-center hidden z-50 overflow-hidden">
            <div class="bg-gray-900 w-[700px] rounded-2xl shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-gray-700 relative animate-fadeIn max-h-[83vh] flex flex-col">
                <!-- Header cố định -->
                <div class="sticky top-0 bg-gray-900 z-10 px-8 pt-6 pb-4 border-b border-gray-800 flex justify-between items-center rounded-tl-2xl rounded-tr-2xl">
                    <h3 class="text-xl font-semibold text-white flex items-center gap-2">
                        <i data-lucide="edit-3" class="w-6 h-6 text-indigo-400"></i>
                        Nhiệm vụ
                    </h3>
                    <button id="closeUpdateTaskBtn"
                            class="text-gray-400 hover:text-white transition">
                        <i data-lucide="x" class="w-5 h-5"></i>
                    </button>
                </div>

                <!-- Nội dung cuộn -->
                <div class="px-8 pb-8 overflow-y-auto custom-scroll">
                    <form id="updateTaskForm" class="flex flex-col gap-6 mt-4">
                        <!-- Tên nhiệm vụ -->
                        <div class="flex flex-col sm:flex-row gap-4">
                            <div class="flex-1">
                                <label class="block text-xs text-gray-300 mb-2">Tên nhiệm vụ</label>
                                <input id="taskName"
                                       value="${task?.nameTask ?? ""}"
                                       type="text"
                                       ${role == "EMPLOYEE"? "disabled":""}
                                       required
                                       class="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                       placeholder="Nhập tên task..." />
                            </div>

                            <!-- Dự án -->
                            <div class="flex-1">
                                <label class="block text-xs text-gray-300 mb-2 font-medium">Dự án</label>
                                <div id="projectOptions" class="relative group ">
                                    <select id="project"
                                        required
                                        ${!task ? "" : "disabled"}
                                        class="appearance-none w-full px-4 text-xs py-2 rounded-lg bg-gray-800/80 border border-gray-700 text-gray-200 font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all hover:bg-gray-800/90 cursor-pointer">
                                        <option value="">---Chọn dự án---</option>
                                        ${renderOptionProject}
                                    </select>
                                    <div class="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400">
                                        <i data-lucide="chevron-down" class="w-4 h-4"></i>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Người nhận -->
                        <div class="flex flex-col sm:flex-row gap-4">
                            <div class="flex-1">
                                <label class="block text-xs text-gray-300 mb-2">Người nhận nhiệm vụ</label>
                                <input id="taskAssignee"
                                       type="text"
                                       ${assigneeDisabled}
                                       value="${task?.nameAssignee ?? ""}"
                                       class="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                       placeholder="Gõ @ và chọn tên người tiếp nhận..." />
                                <input type="hidden" id="taskAssigneeId" name="taskAssigneeId" value="${task?.assignee_Id ?? ""}">
                                <!-- Danh sách gợi ý user -->
                                <ul id="userSuggestions"
                                    class="absolute z-50 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg text-white text-sm hidden
                                               max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-indigo-600 scrollbar-track-gray-700">
                                </ul>
                            </div>
                        </div>

                        <!-- Mô tả -->
                        <div>
                            <label class="block text-xs text-gray-300 mb-2">Mô tả</label>
                            <textarea id="taskDesc"
                                  rows="4"
                                  ${role == "EMPLOYEE" ? "disabled" : ""}
                                  class="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                                  placeholder="Nhập mô tả...">${task?.note ?? ""}</textarea>
                        </div>

                        <!-- Ngày bắt đầu / Ngày kết thúc -->
                        <div class="flex flex-col sm:flex-row gap-4">
                            <div class="flex-1 relative">
                                <label class="block text-xs text-gray-300 mb-1">Ngày bắt đầu</label>
                                <input id="taskStart"
                                       type="date"
                                       required
                                       ${role == "EMPLOYEE" ? "disabled" : ""}
                                       value="${startDate}"
                                       class="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none appearance-none pr-10" />
                                <i data-lucide="calendar"
                                   class="absolute cursor-pointer right-10 top-7 text-gray-400 pointer-events-none w-4 h-4"></i>
                            </div>

                            <div class="flex-1 relative">
                                <label class="block text-xs text-gray-300 mb-1">Ngày kết thúc</label>
                                <input id="taskEnd"
                                       type="date"
                                       required
                                       ${role == "EMPLOYEE" ? "disabled" : ""}
                                       value="${endDate}"
                                       class="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none appearance-none pr-10" />
                                <i data-lucide="calendar"
                                   class="absolute cursor-pointer right-10 top-7 text-gray-400 pointer-events-none w-4 h-4"></i>
                            </div>
                        </div>

                        <!-- Trạng thái & Ưu tiên -->
                        <div class="flex flex-col sm:flex-row gap-4">
                            <div class="flex-1">
                                <label class="block text-xs text-gray-300 mb-2 font-medium">Trạng thái</label>
                                <div class="relative group">
                                    <select id="taskStatus" class="appearance-none w-full px-4 text-xs py-2.5 rounded-xl bg-gray-800/80 border border-gray-700 text-gray-200 font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all hover:bg-gray-800/90 cursor-pointer">
                                        <option value="status-todo" ${task !== null ? (task?.statusName == 1 ? "selected" : "") : ""}>Chưa bắt đầu</option>
                                        <option value="status-inprogress" ${task !== null ? (task?.statusName == 2 ? "selected" : "") : ""}>Đang thực hiện</option>
                                        <option value="status-done" ${task !== null ? (task?.statusName == 3 ? "selected" : "") : ""}>Hoàn thành</option>
                                    </select>
                                    <div class="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400">
                                        <i data-lucide="chevron-down" class="w-4 h-4"></i>
                                    </div>
                                </div>
                            </div>

                            <div class="flex-1">
                                <label class="block text-xs text-gray-300 mb-2 font-medium">Độ ưu tiên</label>
                                <div class="relative group">
                                    <select id="taskPriority" ${role == "EMPLOYEE" ? "disabled" : ""} class="appearance-none w-full px-4 text-xs py-2.5 rounded-xl bg-gray-800/80 border border-gray-700 text-gray-200 font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all hover:bg-gray-800/90 cursor-pointer">
                                        <option value="low" ${task === null ? "" : (task?.priority == "low" ? "selected" : "")}>Thấp</option>
                                        <option value="medium" ${task === null ? "" : (task?.priority == "medium" ? "selected" : "")}>Trung bình</option>
                                        <option value="high" ${task === null ? "" : (task?.priority == "high" ? "selected" : "")}>Cao</option>
                                    </select>
                                    <div class="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400">
                                        <i data-lucide="chevron-down" class="w-4 h-4"></i>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Upload + Preview -->
                        <div class="flex flex-col gap-3">
                            <label class="text-xs text-gray-300 font-medium">Tệp đính kèm</label>
                            <div class="flex flex-col sm:flex-row gap-4 items-stretch">
                                <div class="flex flex-col w-full sm:w-1/3">
                                    <label id="dropZone"
                                           for="fileInputEdit"
                                           class="cursor-pointer flex flex-col items-center justify-center gap-3 flex-1 p-6 border-2 border-dashed border-indigo-500 rounded-lg hover:bg-indigo-600/10 transition-all text-center text-indigo-300">
                                        <i data-lucide="upload" class="w-7 h-7 text-indigo-400"></i>
                                        <span class="font-medium text-white text-xs">Chọn để thêm tệp</span>
                                        <span class="text-xs text-indigo-300">PDF, DOCX, XLSX, PNG...</span>
                                    </label>
                                    <input type="file"
                                           id="fileInputEdit"
                                           value="${task?.fileNote}"
                                           ${role == "EMPLOYEE" ? "disabled" : ""}
                                           class="hidden"
                                           accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xls,.xlsx" />
                                    <!-- Hidden input để giữ file cũ -->
                                    <input type="hidden" id="existingFileUrl" name="existingFileUrl" value="${task?.fileNote ?? ""}"/>
                                    <p id="fileNameEdit"
                                       class="text-sm text-indigo-300 mt-1 truncate overflow-hidden text-ellipsis whitespace-nowrap flex items-center justify-start w-full"></p>
                                </div>

                                <div id="previewContainerEdit"
                                     class="w-full sm:w-2/3 rounded-[10px] border border-indigo-700 overflow-hidden p-6 bg-gray-800 max-h-[200px] overflow-auto text-white flex items-center justify-center">
                                    <p class="text-gray-400 text-sm text-center">Preview File</p>
                                </div>
                            </div>
                        </div>

                        <!-- Nút submit -->
                        <div class="flex justify-end mt-4 gap-2">
                            <button id="deleteBtn" type="button" ${task ? "" : "disabled"}
                                class="${role == "EMPLOYEE" ? "hidden" : ""} px-8 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white text-xs font-medium shadow-md transition-all">
                                Xóa
                            </button>
                            <button type="button" id="confirmUploadBtn"
                                class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white text-xs font-medium shadow-md transition-all">
                                Xác nhận
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>

    `);
}
function handleFilePreviewEdit() {
    const fileInput = document.getElementById("fileInputEdit");
    const previewContainer = document.getElementById("previewContainerEdit");
    const fileNameLabel = document.getElementById("fileNameEdit");
    const hiddenInput = document.getElementById("existingFileUrl");
    const dropZone = document.getElementById("dropZone");

    if (!fileInput || !previewContainer) return;

    // Khi người dùng chọn file mới
    fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        previewContainer.innerHTML = ""; // clear preview cũ

        if (file) {
            fileNameLabel.textContent = file.name;

            const fileURL = URL.createObjectURL(file);
            hiddenInput.value = fileURL; // Lưu tạm vào input hidden (sau này bạn có thể upload thật lên server)

            const ext = file.name.split(".").pop().toLowerCase();

            // Tạo preview tùy theo loại file
            if (["png", "jpg", "jpeg", "gif"].includes(ext)) {
                const img = document.createElement("img");
                img.src = fileURL;
                img.className = "max-h-[180px] rounded-lg object-contain";
                previewContainer.appendChild(img);
            } else if (["pdf"].includes(ext)) {
                const iframe = document.createElement("iframe");
                iframe.src = fileURL;
                iframe.className = "w-full h-[180px] rounded-lg";
                previewContainer.appendChild(iframe);
            } else {
                previewContainer.innerHTML = `
                    <p class="text-sm text-gray-300 flex items-center gap-2">
                        <i data-lucide="file"></i> ${file.name}
                    </p>`;
                lucide.createIcons();
            }
        } else {
            // Không chọn file -> giữ file cũ
            fileNameLabel.textContent = hiddenInput.value ? hiddenInput.value.split("/").pop() : "";
        }
    });

    // Kéo-thả file
    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("bg-indigo-600/10");
    });

    dropZone.addEventListener("dragleave", () => {
        dropZone.classList.remove("bg-indigo-600/10");
    });

    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.classList.remove("bg-indigo-600/10");
        const file = e.dataTransfer.files[0];
        if (file) {
            fileInput.files = e.dataTransfer.files; // gán lại để dùng chung logic
            fileInput.dispatchEvent(new Event("change"));
        }
    });

    // Hiển thị file cũ nếu có (task.fileNote)
    const existing = hiddenInput.value;
    if (existing) {
        const ext = existing.split(".").pop().toLowerCase();
        fileNameLabel.textContent = existing.split("/").pop();

        if (["png", "jpg", "jpeg", "gif"].includes(ext)) {
            previewContainer.innerHTML = `<img src="${existing}" class="max-h-[180px] rounded-lg object-contain" />`;
        } else if (["pdf"].includes(ext)) {
            previewContainer.innerHTML = `<iframe src="${existing}" class="w-full h-[180px] rounded-lg"></iframe>`;
        } else {
            previewContainer.innerHTML = `<p class="text-sm text-gray-300 flex items-center gap-2">
                <i data-lucide="file"></i> ${existing.split("/").pop()}
            </p>`;
            lucide.createIcons();
        }
    }
}

function addAssigneee(members) {
    const input = document.getElementById("taskAssignee");
    const suggestionBox = document.getElementById("userSuggestions");
    const hiddenId = document.getElementById("taskAssigneeId");
    let hasSelected = false;

    // Khi người dùng nhập vào ô input
    input.addEventListener("input", () => {
        const value = input.value.trim();
        hasSelected = false; // reset mỗi khi gõ lại

        // Nếu có @ => lọc danh sách
        if (value.startsWith("@")) {
            const keyword = value.substring(1).toLowerCase();

            const filtered = members.filter(m =>
                m.fullname.toLowerCase().includes(keyword)
            );

            if (filtered.length > 0) {
                suggestionBox.innerHTML = filtered
                    .map(m => `<li data-id="${m.id}" 
                        class="px-3 py-1.5 hover:bg-indigo-600 cursor-pointer rounded-md transition">
                    ${m.fullname}
                  </li>`)
                    .join("");
                suggestionBox.classList.remove("hidden");
            } else {
                suggestionBox.classList.add("hidden");
            }
        } else {
            suggestionBox.classList.add("hidden");
        }
    });

    // Khi click chọn 1 người
    suggestionBox.addEventListener("click", (e) => {
        const li = e.target.closest("li");
        if (!li) return;
        const name = li.textContent.trim();
        const id = li.dataset.id;

        input.value = name;
        hiddenId.value = id;
        hasSelected = true;

        suggestionBox.classList.add("hidden");
    });

    // Nếu người dùng blur ra ngoài mà chưa chọn ai thì xoá input
    input.addEventListener("blur", () => {
        setTimeout(() => {
            if (!hasSelected) {
                input.value = "";
                hiddenId.value = "";
            }
            suggestionBox.classList.add("hidden");
        }, 200); // delay để tránh conflict với click chọn
    });
}
function closeFormModal(projects) {
    // Task Modal
    const closeBtn = document.getElementById("closeUpdateTaskBtn");
    const modal = document.getElementById("updateTaskModal");
    const uploadOverlay = document.getElementById(`uploadOverlay`);
    closeBtn.addEventListener("click", () => {
        modal.classList.add("hidden");
        uploadOverlay.classList.add("hidden");
        setTimeout(() => modal.remove(), 300); // Xóa hẳn sau 0.3s
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            modal.classList.add("hidden");
            uploadOverlay.classList.add("hidden");
            setTimeout(() => modal.remove(), 300); // Xóa hẳn sau 0.
        }
    });
}

// Hàm chuyển đổi ngày về dạng YYYY-MM-DD theo giờ địa phương
function formatDateToLocalInput(dateString) {
    if (!dateString) return "";
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "";

    const year = d.getFullYear();
    // Tháng bắt đầu từ 0 nên phải +1
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

async function openTaskModal(task = null, role) {
    // Overlay
    const uploadOverlay = document.getElementById(`uploadOverlay`);
    uploadOverlay.classList.remove("hidden");

    if (allProjectsList.length === 0) {
        //console.log("Cache project list rỗng, đang fetch lần đầu...");
        try {
            // Chờ fetch và lưu vào cache toàn cục
            allProjectsList = await safeFetchJson("/api/projects/list", []);
            //console.log("✅ Đã fetch và cache project list:", allProjectsList);
        } catch (err) {
            console.error("LỖI NGHIÊM TRỌNG: Không thể fetch project list cho modal.", err);
            // Báo lỗi và đóng modal
            uploadOverlay.classList.add("hidden");
            alert("Lỗi: Không thể tải danh sách dự án. Vui lòng thử lại.");
            return; // Dừng hàm
        }
    }

    // Tạo modal HTML từ formTask
    const modalHTML = formTask(task, allProjectsList, members, role);

    // Thêm vào DOM (nếu chưa có)
    let existingModal = document.getElementById("updateTaskModal");
    if (existingModal) existingModal.remove();
    document.body.insertAdjacentHTML("beforeend", modalHTML);

    // Hiện modal
    const modal = document.getElementById("updateTaskModal");
    modal.classList.remove("hidden");

    handleFilePreviewEdit();
    handleConfirm(task);
    if (task) {
        handleDelete(task.idTask);
    }

    // Kích hoạt icon lucide
    lucide.createIcons();

    closeFormModal();

    var members;


    // 🟣 Hàm kiểm tra ràng buộc ngày
    const validateDates = () => {
        const taskStart = document.getElementById("taskStart");
        const taskEnd = document.getElementById("taskEnd");

        if (!taskStart || !taskEnd) return;

        const startVal = taskStart.value;
        const endVal = taskEnd.value;

        if (startVal && endVal && endVal < startVal) {
            alert("❌ Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu!");
            taskEnd.value = startVal; // tự động sửa lại cho hợp lệ
        }
    };

    if (allProjectsList) {
        //console.log("Projects: NOT NULL");
    } else {
        //console.log("Projects: NULL");
    }
    if (task) {
        members = await fetchMemberByProject(task.projectId);
        addAssigneee(members);

        const project = allProjectsList.find(p => p.idProject == task.projectId);
        if (project) {
            const startProj = new Date(project.startDay).toISOString().split("T")[0];
            const endProj = new Date(project.endDay).toISOString().split("T")[0];
            const taskStart = document.getElementById("taskStart");
            const taskEnd = document.getElementById("taskEnd");

            taskStart.min = startProj;
            taskStart.max = endProj;
            taskEnd.min = startProj;
            taskEnd.max = endProj;
        }
    }
    else {
        const projectSelect = document.getElementById("project");

        projectSelect.addEventListener("change", async (e) => {
            const projectId = e.target.value;
            const assigneeInput = document.getElementById("taskAssignee");
            const taskStart = document.getElementById("taskStart");
            const taskEnd = document.getElementById("taskEnd");
            if (!projectId) {
                assigneeInput.value = "";
                assigneeInput.setAttribute("disabled", true);
                taskStart.removeAttribute("min");
                taskStart.removeAttribute("max");
                taskEnd.removeAttribute("min");
                taskEnd.removeAttribute("max");
                return;
            }

            // Gọi API load member theo project
            members = await fetchMemberByProject(projectId);
            currentProject = e.target.value;

            // 🔹 Lấy ngày bắt đầu và kết thúc của project
            const project = allProjectsList.find(p => p.idProject == projectId);
            if (project) {
                //console.log("YES: ", project);
                const startProj = formatDateToLocalInput(project.startDay);
                const endProj = formatDateToLocalInput(project.endDay);

                // Ràng buộc ngày trong form
                taskStart.min = startProj;
                taskStart.max = endProj;
                taskEnd.min = startProj;
                taskEnd.max = endProj;

                // 🟢 Thêm sự kiện kiểm tra ràng buộc ngày
                if (typeof validateDates === "function") {
                    taskStart.removeEventListener("change", validateDates); // Xóa event cũ tránh trùng lặp
                    taskEnd.removeEventListener("change", validateDates);

                    taskStart.addEventListener("change", validateDates);
                    taskEnd.addEventListener("change", validateDates);
                }
            }

            if (members && members.length > 0) {
                assigneeInput.removeAttribute("disabled");
                addAssigneee(members); // hàm render danh sách gợi ý user
            }
        });

    }
}
function getUpdatedTaskFromForm(oldTask = {}) {
    const name = document.getElementById("taskName")?.value.trim();
    const description = document.getElementById("taskDesc")?.value.trim() || "";
    const startDate = document.getElementById("taskStart")?.value || "";
    const endDate = document.getElementById("taskEnd")?.value || "";
    const projectId = document.getElementById("project")?.value || "";
    const memberId = document.getElementById("taskAssigneeId")?.value || null   ;
    const status = document.getElementById("taskStatus")?.value || "";
    const prior = document.getElementById("taskPriority")?.value || "";
    const file = document.getElementById("existingFileUrl")?.value || "";

    var isValid = (name != null && name != "");
    if (!isValid) {
        alert("Vui lòng nhập đầy đủ thông tin.");
        return;
    }

    const t = {
        ...oldTask, // giữ lại dữ liệu cũ
        Id: (oldTask && oldTask.idTask != "") ? oldTask.idTask : crypto.randomUUID(),
        Name: name,
        Desc: description,
        Start: startDate,
        End: endDate,
        IdPrj: projectId,
        IdAss: memberId,
        Status: status,
        Prior: prior,
        File: file,
    }
    // Gộp lại thành object mới
    return t;
}

function renderLabel(status, isOverdue) {
    let statusText = "";
    let statusClass = "";

    // 🟢 Xác định trạng thái theo tiến độ
    switch ((status || "").toString().toLowerCase()) {
        case "1":
            statusText = "CHƯA BẮT ĐẦU";
            statusClass = isOverdue
                ? "bg-red-900/40 text-white border-red-900"
                : "bg-gray-700/40 text-gray-300 border-gray-600";
            break;
        case "2":
            statusText = "ĐANG THỰC HIỆN";
            statusClass = isOverdue
                ? "bg-red-900/40 text-white border-red-900"
                : "bg-blue-900/40 text-blue-400 border-blue-900";
            break;
        case "3":
            statusText = "HOÀN THÀNH";
            statusClass = isOverdue
                ? "bg-red-900/40 text-white border-red-900"
                : "bg-green-900/40 text-green-400 border-green-900";
            break;
        default:
            if (isOverdue) {
                statusText = "TRỄ HẠN";
                statusClass = "bg-red-900/40 text-red-400 border-red-600";
            } else {
                statusText = "KHÔNG XÁC ĐỊNH";
                statusClass = "bg-gray-900/40 text-gray-400 border-gray-600";
            }
            break;
    }

    return `
        <span class="px-4 inline-flex items-center rounded-full border text-[10px] ${statusClass}">${statusText}</span>
    `;
}


function filterHighPrior() {
    const checkbox = document.getElementById("priorityHigh");
    const taskCards = document.querySelectorAll(".task-card");

    checkbox.addEventListener("change", function () {
        const showHighOnly = checkbox.checked;

        taskCards.forEach(card => {
            const priority = card.dataset.priority?.toLowerCase();
            const isHigh = (priority === "cao" || priority === "high");

            if (showHighOnly && !isHigh) {
                card.classList.add("hidden-task");
                setTimeout(() => (card.style.display = "none"), 300);
            } else {
                card.style.display = "block";
                setTimeout(() => card.classList.remove("hidden-task"), 10);
            }
        });
    });
}

/**
 * Cắt chuỗi và thêm dấu "..."
 * @param {string} str - Chuỗi cần cắt
 * @param {number} maxLength - Độ dài tối đa
 */
function truncateString(str, maxLength = 50) {
    if (!str) return ""; // Xử lý nếu chuỗi bị null
    if (str.length <= maxLength) {
        return str;
    }
    return str.slice(0, maxLength) + "...";
}
function handleConfirm(task) { // 'task' ở đây là object task GỐC (trước khi sửa)
    document.getElementById("confirmUploadBtn").addEventListener("click", async () => {
        const updatedTask = getUpdatedTaskFromForm(task); // Lấy data MỚI từ form
        if (!updatedTask) return;

        // ... (phần kiểm tra requiredFields giữ nguyên) ...
        const requiredFields = ["Name", "IdPrj", "Start", "End"];
        for (const field of requiredFields) {
            if (!updatedTask[field] || updatedTask[field].trim() === "") {
                alert(`❌ Trường "${field}" không được để trống.`);
                return;
            }
        }

        const loadingOverlay = document.getElementById(`loadingOverlay`);
        try {
            loadingOverlay.classList.remove("hidden");
            const res = await fetch("/Home/SaveTask", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: 'include',
                body: JSON.stringify(updatedTask)
            });

            const data = await res.json();

            if (data.success) {
                closeFormModal();

                // ======================================================
                // SỬA: LOGIC GỬI NOTIFY THÔNG MINH HƠN
                // ======================================================
                const newAssigneeId = updatedTask["IdAss"];

                // Lấy ID assignee CŨ (nếu là task CŨ và có 'idAss')
                const oldAssigneeId = (task && task.idAss) ? task.idAss : null;

                // Chỉ gửi notify nếu:
                // 1. Có assignee mới (không rỗng)
                // 2. Assignee mới KHÁC assignee cũ
                if (newAssigneeId && newAssigneeId.trim() !== "" && newAssigneeId !== oldAssigneeId) {
                    // --- SỬA: Lấy tên Project (3 bước) ---
                    let projectName = "Không rõ"; // Giá trị mặc định
                    try {
                        // 1. Fetch (thêm credentials)
                        const projectRes = await fetch(`/api/projects/${updatedTask["IdPrj"]}/name`, {
                            credentials: 'include'
                        });

                        // 2. Kiểm tra OK và lấy JSON
                        if (projectRes.ok) {
                            const projectData = await projectRes.json();
                            projectName = projectData.projectName; // 3. Lấy tên
                        }
                    } catch (e) {
                        console.warn("Không thể lấy tên project.", e);
                    }
                    //console.log("Tên project để gửi notify:", projectName);
                    // --- Hết phần sửa lấy tên project ---

                    const truncatedProjectName = truncateString(projectName, 50);
                    const truncatedTaskName = truncateString(updatedTask.Name, 50);

                    try {
                        await fetch("/api/notification/push", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            credentials: 'include',
                            body: JSON.stringify({
                                UserId: newAssigneeId,
                                Title: `Giao công việc`,
                                Message: `
                                    Bạn được giao nhiệm vụ mới 🔔
                                    <br/>
                                    <span class="text-green-500"><strong>Dự án</strong></span>: ${truncatedProjectName}
                                    <br/>
                                    <span class="text-green-500"><strong>Nhiệm vụ</strong></span>: ${truncatedTaskName}
                                `
                            })
                        });
                    } catch (notifyErr) {
                        console.error("🔥 Lỗi gửi notify:", notifyErr);
                    }
                }
                // ======================================================

                location.reload(); // Chỉ reload khi thành công

            } else {
                alert("❌ Lưu thất bại: " + (data.message || "Không rõ lỗi"));
                loadingOverlay.classList.add("hidden");
            }
        } catch (e) {
            loadingOverlay.classList.add("hidden");
            console.error("🔥 Lỗi gửi dữ liệu:", e);
            alert("❌ Đã xảy ra lỗi nghiêm trọng. Vui lòng thử lại.");
        }
    });
}

function handleDelete(taskId) {
    const deleteBtn = document.getElementById("deleteBtn");
    deleteBtn.addEventListener("click", async () => {
        const loadingOverlay = document.getElementById(`loadingOverlay`);
        //console.log(taskId);
        if (!taskId) {
            alert("⚠️ Không tìm thấy ID task để xóa!");
            return;
        }

        if (!confirm("Bạn có chắc muốn xóa task này không?")) return;

        try {
            loadingOverlay.classList.remove("hidden");
            const res = await fetch(`/Home/DeleteTask?id=${taskId}`, { method: "DELETE" });
            const data = await res.json();

            if (data.success) {
                closeFormModal();
                location.reload();
            } else {
                //console.log("❌ " + data.message);
            }
        } catch (e) {
            loadingOverlay.classList.add("hidden");
            console.error("🔥 Lỗi khi xóa task:", e);
            //console.log("⚠️ Không thể xóa task. Kiểm tra lại kết nối hoặc server.");
        }
    });
}

function viewFile(fileUrl) {
    if (!fileUrl || fileUrl.trim() === "") {
        alert("Không có tệp để xem!");
        return;
    }

    // Nếu fileUrl là đường dẫn tương đối -> thêm base URL
    if (!fileUrl.startsWith("http")) {
        fileUrl = `${window.location.origin}/${fileUrl}`;
    }

    window.open(fileUrl, "_blank"); // mở tab mới
}

function downloadFile(fileUrl) {
    if (!fileUrl || fileUrl.trim() === "") {
        alert("Không có tệp để tải xuống!");
        return;
    }

    // Nếu đường dẫn tương đối -> thêm base URL
    if (!fileUrl.startsWith("http")) {
        fileUrl = `${window.location.origin}/${fileUrl}`;
    }

    // Tạo a tag tạm để download
    const link = document.createElement("a");
    link.href = fileUrl;

    // Lấy tên file từ URL
    const fileName = fileUrl.split("/").pop();
    link.download = fileName;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
