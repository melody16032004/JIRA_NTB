
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
//let currentUser = {};
let currentUserRole = '';
let isProjectToggleAllOpen = false;
const PAGE_SIZE = 5;
const TASK_PAGE_SIZE = 3;
let currentUserPageIndex = 1;
const USER_PAGE_SIZE = 5;
let totalAssigneeUsers = 0;
let ganttChartInstance = null;
let currentProjectDepartmentFilter = 'all';
let cachedDepartments = [];
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
        // 1. Lấy response trực tiếp
        const res = await fetch(url);

        // 2. Xử lý các mã lỗi đặc biệt (Redirect)
        if (res.status === 401) {
            window.location.href = '/Account/Login';
            return defaultValue; // Trả về default để tránh lỗi trong lúc chờ chuyển trang
        }
        if (res.status === 500) {
            window.location.href = '/Error/500';
            return defaultValue;
        }

        // 3. Kiểm tra nếu request thất bại (400, 404, 403...)
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
            //attachTaskButtonListeners(container);

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

    let deptOptions = `<option value="all">Tất cả phòng ban</option>`;
    if (window.allDepartments) {
        window.allDepartments.forEach(d => {
            const selected = d.idDepartment == currentProjectDepartmentFilter ? "selected" : "";
            deptOptions += `<option value="${d.idDepartment}" ${selected}>${d.departmentName}</option>`;
        });
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
    let countProjectDone = projectsStat.Completed || 0;
    let countTask = tasksStat.TotalTasks || 0;
    let countTaskDone = tasksStat.CompletedTasks || 0;
    let countTaskInProgress = tasksStat.InProgressTasks || 0;
    let countTaskTodo = tasksStat.TodoTasks || 0;
    let countTaskOverDue = tasksStat.OverdueTasks || 0;

    let countToDo = projectsStat.Todo || 0;
    let countInProgress = projectsStat.InProgress || 0;
    let countDone = projectsStat.Completed || 0;
    let countOverdue = projectsStat.Overdue || 0;

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
        mainViewContent = `
            <div class="space-y-4 max-h-[630px] overflow-y-auto custom-scroll">
                ${viewProjectContainer}
            </div>
        `;

    let deptOptionsHtml = `<option value="all">Tất cả phòng ban</option>`;
    if (cachedDepartments && cachedDepartments.length > 0) {
        deptOptionsHtml += cachedDepartments.map(d => {
            // Kiểm tra xem có phải đang chọn phòng này không
            const isSelected = d.idDepartment == currentProjectDepartmentFilter ? "selected" : "";
            return `<option value="${d.idDepartment}" ${isSelected}>${d.departmentName}</option>`;
        }).join("");
    }

    const leftColumn = `
        <div class="lg:col-span-2 bg-gradient-to-b from-gray-900 to-gray-800 rounded-2xl shadow-lg p-4">
            <div class="flex flex-col md:flex-row md:justify-between md:items-center mb-4 gap-4 md:gap-0">
                <h2 class="text-md font-semibold text-white">Dự án & Nhiệm vụ</h2>
                <div class="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                    <select id="project-department-filter"
                        class="${role == "ADMIN" ? "" : "hidden"} bg-gray-700 text-gray-300 text-xs rounded-lg px-3 py-1.5 border border-gray-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 outline-none transition mr-2">
                        ${deptOptionsHtml}
                    </select>
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
                </div>
            </div>

            <hr class="border-t border-gray-700 my-4" />

            <div class="space-y-4">
                ${controllButton}
            </div>
            <div id="project-list-view" class="space-y-4 mt-[20px] max-h-[630px] overflow-y-auto custom-scroll">
                ${viewProjectContainer}
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

            <!-------------------- GANTT CHART THEO NHÂN SỰ ------------------>
<!--
            <div id="assignee-gantt-container" class="w-full bg-gray-800 rounded-2xl shadow-lg border border-gray-700 p-4 relative min-h-[400px] overflow-hidden">
                <div class="flex justify-between items-center mb-4">
                    <div class="flex items-center gap-3">
                        <h3 class="text-lg font-semibold text-white flex items-center gap-2">
                            <i data-lucide="users" class="w-5 h-5 text-indigo-400"></i>
                            Tiến độ theo nhân sự
                        </h3>
                    </div>
                    <div>
                        <button id="gantt-prev" class="p-1.5 rounded hover:bg-gray-600 text-gray-400 hover:text-white transition" title="Hiển thị chi tiết">
                            <i data-lucide="chevron-left" class="w-4 h-4 text-white"></i>
                        </button>
                        <button id="gantt-next" class="p-1.5 rounded hover:bg-gray-600 text-gray-400 hover:text-white transition" title="Hiển thị chi tiết">
                            <i data-lucide="chevron-right" class="w-4 h-4 text-white"></i>
                        </button>
                        <button id="gantt-check" class="p-1.5 rounded hover:bg-gray-600 text-gray-400 hover:text-white transition" title="Hiển thị chi tiết">
                            <i data-lucide="eye" class="w-4 h-4 text-white"></i>
                        </button>
                        <button id="gantt-reload" class="p-1.5 rounded hover:bg-gray-600 text-gray-400 hover:text-white transition" title="Làm mới">
                            <i data-lucide="refresh-cw" class="w-4 h-4 text-white"></i>
                        </button>
                        <button id="gantt-expand" class="p-1.5 rounded hover:bg-gray-600 text-gray-400 hover:text-white transition" title="Mở rộng">
                            <i data-lucide="maximize-2" class="w-4 h-4 text-white"></i>
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
-->
            <!------------------------------------------------------------------>

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
}

/**
 * Hàm này gom tất cả các event listener lại một chỗ
 * Nó sẽ được gọi lại MỖI KHI renderDashboard
 */
function attachAllEventListeners(projects, role) {
    const deptFilter = document.getElementById("project-department-filter");
    if (deptFilter) {
        // Clone nút để xóa event cũ
        const newSelect = deptFilter.cloneNode(true);
        deptFilter.parentNode.replaceChild(newSelect, deptFilter);

        newSelect.addEventListener("change", async (e) => {
            // 1. Cập nhật biến toàn cục
            currentProjectDepartmentFilter = e.target.value;
            //console.log("🔍 Đang lọc theo phòng ban:", currentProjectDepartmentFilter);

            // 2. Gọi hàm loadPageData (nó sẽ gọi API mới và vẽ lại giao diện)
            // Quay về trang 1 khi filter thay đổi
            await loadPageData(1);
        });
    }

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
let currentDepartmentFilter = '';
let currentLoadedTasks = [];

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
        const newProjects = await safeFetchJson(`/api/projects?pageIndex=${page}&pageSize=${pageSize}&departmentId=${currentProjectDepartmentFilter}`);

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

    if (currentUserRole === "ADMIN") {
        try {
            cachedDepartments = await safeFetchJson("/api/departments/list", []);
        } catch (e) { console.error(e); }

        //try {
        //    const depts = await safeFetchJson("/api/departments/list", []);
        //    // Lưu depts vào biến toàn cục hoặc render ngay nếu select box nằm tĩnh trong _Layout
        //    // Nhưng vì select box nằm trong renderDashboard (sinh động), ta cần lưu lại data để dùng sau.
        //    window.allDepartments = depts;
        //} catch (e) { console.error(e); }
    }

    // --- Bước 1: Chỉ fetch thông tin user ---
    //const me = await safeFetchJson("/api/user/me", null);
    //currentUser = me; // Lưu vào state toàn cục

    // --- Bước 2: Kiểm tra User TRƯỚC KHI fetch phần còn lại ---
    //if (!currentUser || currentUser == null) {
    //    console.warn("User không hợp lệ hoặc chưa đăng nhập. Đang chuyển hướng...");
    //    window.location.href = "/Error/403";
    //    return; // Dừng thực thi ngay lập tức
    //}

    // Nếu user OK, log và tiếp tục
    //console.log("User:", me);

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
        }, 300);
    }
});

console.log();
// _____________________________________________________
// ===================|        |========================
// -------------------| HELPER |------------------------
// ===================|________|========================
// =====================================================

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
