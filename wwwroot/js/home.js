// =================================================================
// CÁC BIẾN TOÀN CỤC VÀ TRẠNG THÁI
// =================================================================
const overlay = `<div id="uploadOverlay" class="fixed inset-0 bg-black/80 hidden z-40"></div>`;
const loading = `
    <div id="loadingOverlay" class="hidden fixed inset-0 bg-black bg-opacity-60 flex flex-col items-center justify-center z-[9999] backdrop-blur-sm">
        <div class="flex flex-col items-center">
            <div class="w-14 h-14 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <p class="mt-4 text-white text-lg font-medium tracking-wide animate-pulse">
                Đang xử lý, vui lòng chờ...
            </p>
        </div>
    </div>
`;

// Trạng thái phân trang
let currentPage = 1;
let totalPages = 1;
let isLoadingProjects = false;
let isPriorityFilterActive = false;

// Biến cache (để không phải fetch nhiều lần)
let allProjectsData = []; // Cache project data để mở modal "Add Task"
let allDepartmentsData = [];

// =================================================================
// KHỞI CHẠY KHI DOM LOADED
// =================================================================
document.addEventListener("DOMContentLoaded", async () => {
    initDashboard();
});

async function initDashboard() {
    // 1. Chèn HTML cơ bản (loading, overlay)
    const container = document.getElementById("projectContainer");
    if (!container) {
        console.error("Không tìm thấy #projectContainer!");
        return;
    }
    // Chèn HTML khung
    container.innerHTML = `
        ${loading}
        ${overlay}
        <div id="dashboard-cards" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
            </div>
        
        <div class="font-mono tracking-wide grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-screen text-gray-200">
            <div id="left-column" class="lg:col-span-2 bg-gradient-to-b from-gray-900 to-gray-800 rounded-2xl shadow-lg p-4">
                </div>
            
            <div id="right-column" class="space-y-6">
                </div>
        </div>
    `;

    // 2. Hiển thị loading chính
    const loadingOverlay = document.getElementById("loadingOverlay");
    loadingOverlay.classList.remove("hidden");

    // 3. Tải song song dữ liệu (Summary + Page 1 Projects)
    try {
        await Promise.all([
            loadSummaryData(), // Tải thẻ và biểu đồ
            loadProjects(1),     // Tải trang 1 của dự án
            loadDepartments()  // Tải phòng ban về cache
        ]);

        // 4. Gắn các event chung (chỉ 1 lần)
        setupGlobalListeners();

        // 5. Thiết lập infinite scroll
        setupInfiniteScroll();

    } catch (error) {
        console.error("Lỗi khởi tạo dashboard:", error);
        document.getElementById("left-column").innerHTML = `<p class="text-red-400">Không thể tải dữ liệu. Vui lòng thử lại.</p>`;
    } finally {
        // 6. Tắt loading chính
        loadingOverlay.classList.add("hidden");
        lucide.createIcons();
    }
}

// =================================================================
// 1. TẢI SUMMARY (THẺ + BIỂU ĐỒ)
// =================================================================
async function loadSummaryData() {
    try {
        const res = await fetch("/api/dashboard/summary");
        if (!res.ok) throw new Error("Lỗi tải summary");
        const data = await res.json();

        console.log("[92]: ", data);

        const { projectSummary: p, taskSummary: t } = data;

        // Render 4 thẻ
        const cardContainer = document.getElementById("dashboard-cards");
        cardContainer.innerHTML = `
            ${createCard1(p.countProject, p.countProjectDone)}
            ${createCard2(t.countTask, t.countTaskDone)}
            ${createCard3(t.countTaskInProgress, t.countTaskTodo)}
            ${createCard4(t.countTaskOverDue, t.countTask)}`;

        // Render 2 biểu đồ
        const rightColumn = document.getElementById("right-column");
        rightColumn.innerHTML = `
            ${createChart1()}
            ${createChart2()}`;

        // Vẽ biểu đồ (phải chờ DOM update)
        renderAfterDOMUpdate(() => {
            renderStatusChart(t.countTaskTodo, t.countTaskInProgress, t.countTaskDone, t.countTaskOverDue);
            renderProgressChart(p.countToDo, p.countInProgress, p.countProjectDone, p.countOverdue);
        });

    } catch (error) {
        console.error("Lỗi loadSummaryData:", error);
        document.getElementById("dashboard-cards").innerHTML = `<p class="text-red-400">Lỗi tải summary cards.</p>`;
    }
}

// =================================================================
// 2. TẢI DỰ ÁN (PHÂN TRANG)
// =================================================================
async function loadProjects(page) {
    if (isLoadingProjects || (page > totalPages && totalPages > 1)) return;
    isLoadingProjects = true;

    // TODO: Hiển thị spinner nhỏ ở cuối danh sách (nếu muốn)
    console.log(`Đang tải dự án trang ${page}...`);

    try {
        const res = await fetch(`/api/projects?page=${page}&pageSize=10`);
        if (!res.ok) throw new Error("Lỗi tải dự án");

        const data = await res.json();
        console.log("[137]: ", data);
        currentPage = data.currentPage;
        totalPages = data.totalPages;

        const leftColumn = document.getElementById("left-column");

        // Lần đầu (page 1), render cả header
        if (page === 1) {
            allProjectsData = []; // Reset cache
            leftColumn.innerHTML = `
                ${createLeftColumnHeader()}
                <hr class="border-t border-gray-700 my-4" />
                <div class="space-y-4" id="project-list-container">
                    ${createControlButtons()}
                    </div>
                <div id="project-loader" class="text-center py-4 hidden">
                     <div class="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
            `;
            // Gắn event cho các nút vừa tạo
            attachHeaderListeners();
        }

        const projectListContainer = document.getElementById("project-list-container");

        if (data.items.length === 0 && page === 1) {
            projectListContainer.innerHTML += createViewProjectNull();
            return;
        }

        // Tạo HTML cho từng dự án
        let projectsHTML = "";
        data.items.forEach(p => {
            allProjectsData.push(p); // Thêm vào cache
            projectsHTML += createProjectView(p);
        });

        // Chèn dự án mới vào danh sách
        projectListContainer.innerHTML += projectsHTML;

        // Gắn event toggle cho CÁC DỰ ÁN MỚI TẢI
        const newProjectElements = projectListContainer.querySelectorAll(`[data-page-loaded="${page}"]`);
        newProjectElements.forEach(div => {
            const toggleButton = div.querySelector('[data-toggle]');
            toggleButton.addEventListener("click", () => handleProjectToggle(toggleButton));
        });

        // Gắn event cho nút "Add File"
        attachAddFileListeners(newProjectElements);

        // Kích hoạt icons
        lucide.createIcons();

    } catch (error) {
        console.error("Lỗi loadProjects:", error);
        document.getElementById("project-list-container").innerHTML = `<p class="text-red-400">Lỗi tải danh sách dự án.</p>`;
    } finally {
        isLoadingProjects = false;
        // Ẩn spinner
        const loader = document.getElementById("project-loader");
        if (loader) loader.classList.add("hidden");
    }
}

// =================================================================
// 3. THIẾT LẬP INFINITE SCROLL
// =================================================================
function setupInfiniteScroll() {
    const loader = document.getElementById("project-loader");
    if (!loader) return;

    const observer = new IntersectionObserver(async (entries) => {
        if (entries[0].isIntersecting && !isLoadingProjects && currentPage < totalPages) {
            loader.classList.remove("hidden"); // Hiện spinner
            await loadProjects(currentPage + 1);
            loader.classList.add("hidden"); // Ẩn spinner
        }
    }, {
        root: null, // viewport
        threshold: 0.1
    });

    observer.observe(loader);
}

// =================================================================
// 4. LOGIC LAZY-LOAD TASKS KHI MỞ PROJECT
// =================================================================
async function handleProjectToggle(btn) {
    const targetId = btn.getAttribute("data-toggle");
    const content = document.getElementById(targetId);
    const icon = btn.querySelector("svg[data-lucide='chevron-right']");
    const isOpen = btn.classList.contains("open");

    // Logic animation
    if (isOpen) {
        content.style.maxHeight = "0px";
        btn.classList.remove("open");
        if (icon) icon.style.transform = "rotate(0deg)";
    } else {
        // Tạm set maxHeight để có animation
        content.style.maxHeight = "1000px";
        btn.classList.add("open");
        if (icon) icon.style.transform = "rotate(90deg)"; // Sửa: -90deg mới đúng
    }

    // Logic LAZY LOAD
    const taskContainer = content.querySelector(".task-list-placeholder");
    if (taskContainer && taskContainer.dataset.loaded === "false") {
        const projectId = taskContainer.dataset.projectId;
        await loadTasksForProject(projectId, taskContainer);
        // Sau khi load xong, set lại maxHeight để nội dung vừa vặn
        content.style.maxHeight = `${content.scrollHeight}px`;
    } else if (!isOpen) {
        // Nếu đã load rồi, chỉ cần set lại scrollHeight
        content.style.maxHeight = `${content.scrollHeight}px`;
    }
}

async function loadTasksForProject(projectId, container) {
    try {
        // Hiển thị spinner local
        container.innerHTML = `
            <div class="flex items-center justify-center py-8">
                <div class="w-6 h-6 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <span class="ml-2 text-gray-300">Đang tải nhiệm vụ...</span>
            </div>`;
        container.dataset.loaded = "loading";

        const res = await fetch(`/api/tasks?projectId=${projectId}`);
        if (!res.ok) throw new Error("Lỗi tải tasks");

        const tasks = await res.json();
        console.log("[270]: ", tasks);
        let taskListView = "";

        if (tasks.length > 0) {
            tasks.forEach(t => {
                taskListView += createTaskView(t);
            });
        } else {
            taskListView = createViewTaskNull();
        }

        container.innerHTML = taskListView;
        container.dataset.loaded = "true";

        // Gắn event cho các nút "Xem chi tiết" (bolt) CỦA CÁC TASK MỚI
        container.querySelectorAll("[id^='openUpdateTaskBtn#']").forEach(btn => {
            btn.addEventListener("click", () => {
                const task = JSON.parse(btn.getAttribute("data-task"));
                // allProjectsData đã được cache từ loadProjects()
                openTaskModal(task, allProjectsData);
            });
        });

        // ======================================================
        // PHẦN SỬA LỖI QUAN TRỌNG:
        // Áp dụng bộ lọc hiện tại cho các task vừa mới tải
        // ======================================================
        if (isPriorityFilterActive) {
            container.querySelectorAll(".task-card").forEach(card => {
                applyPriorityFilterToCard(card);
            });
        }

        // Kích hoạt icons cho tasks
        lucide.createIcons();
    } catch (error) {
        console.error(`Lỗi tải task cho project ${projectId}:`, error);
        container.innerHTML = `<p class="text-red-400 p-4">Lỗi tải nhiệm vụ.</p>`;
        container.dataset.loaded = "false"; // Cho phép thử lại
    }
}

// =================================================================
// 5. CÁC HÀM GẮN EVENT (LISTENERS)
// =================================================================

// Gắn các event chỉ chạy 1 LẦN
function setupGlobalListeners() {
    // Nút "Thêm dự án" (Tạm thời chưa xử lý)
    // document.getElementById("add-project-btn").addEventListener("click", () => { ... });

    // Nút "Thêm nhiệm vụ" (Dùng cache allProjectsData)
    document.getElementById("add-task-btn").addEventListener("click", () => {
        openTaskModal(null, allProjectsData);
    });
}

// Gắn event cho các nút ở header cột trái (Tìm kiếm, Lọc, Thu gọn)
function attachHeaderListeners() {
    // Tìm kiếm
    document.getElementById("searchInput").addEventListener("input", function () {
        const keyword = this.value.toLowerCase();
        // Lọc trên các project card (chưa tối ưu, chỉ lọc trên DOM hiện tại)
        // TODO: Nên gọi API search
        document.querySelectorAll(".project-card").forEach(card => {
            const text = card.textContent.toLowerCase();
            card.style.display = text.includes(keyword) ? "block" : "none";
        });
    });

    // Lọc ưu tiên cao
    filterHighPriorHome();

    // Nút thu gọn/mở rộng tất cả
    toggleAllProjects();
}

// Gắn event cho nút "Add file" (cho project)
function attachAddFileListeners(projectElements) {
    projectElements.forEach(projectDiv => {
        projectDiv.querySelectorAll("[id^='addFileBtn#']").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation(); // Ngăn sự kiện click lan ra ngoài
                const projectId = btn.dataset.project;
                alert(`Chức năng 'Thêm file' cho project ${projectId} chưa được cài đặt.`);
                // TODO: Mở modal upload file cho project
            });
        });
    });
}

// =================================================================
// 6. CÁC HÀM RENDER HTML (TÁCH BIỆT LOGIC VÀ VIEW)
// =================================================================

// --- Render Thẻ ---
function createCard1(countProject, countProjectDone) {
    const percentage = (countProject == 0 ? 0 : (countProjectDone / countProject) * 100).toFixed(2);
    return `
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
            <li>• Tỷ lệ: <span id="duanhoanthanhpro" class="text-indigo-400 font-medium">${percentage}%</span></li>
        </ul>
    </div>`;
}

function createCard2(countTask, countTaskDone) {
    const percentage = (countTask == 0 ? 0 : (countTaskDone / countTask) * 100).toFixed(2);
    return `
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
            <li>• Tỷ lệ: <span id="nhiemvuhoanthanhpro" class="text-green-400 font-medium">${percentage}%</span></li>
        </ul>
    </div>`;
}

function createCard3(countTaskInProgress, countTaskTodo) {
    return `
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
            <li>• Tạm dừng: <span class="text-gray-300 font-medium">0</span></li>
        </ul>
    </div>`;
}

function createCard4(countTaskOverDue, countTask) {
    const percentage = (countTask == 0 ? 0 : (countTaskOverDue / countTask) * 100).toFixed(2);
    return `
    <div class="font-mono tracking-wide bg-gray-900 border-t-4 border-red-500 rounded-xl shadow-md p-3 hover:shadow-red-500/30 transition transform hover:-translate-y-0.5 duration-300 opacity-0 animate-cardFadeIn delay-[100ms]">
        <div class="flex items-center justify-between">
            <div class="p-2.5 rounded-full bg-red-600/20 text-red-400">
                <i data-lucide="alert-triangle" class="w-4 h-4"></i>
            </div>
            <p id="nhiemvuquahan" class="text-2xl font-bold text-white">${countTaskOverDue}</p>
        </div>
        <h3 class="mt-2 text-gray-200 font-semibold text-sm">NHIỆM VỤ QUÁ HẠN</h3>
        <ul class="mt-1.5 text-xs text-gray-400 space-y-0.5">
            <li>• Tổng nhiệm vụ: <span class="text-gray-300 font-medium">${countTask}</span></li>
            <li>• Tỷ lệ: <span id="nhiemvuquahanpro" class="text-red-400 font-medium">${percentage}%</span></li>
        </ul>
    </div>`;
}

// --- Render Biểu đồ ---
function createChart1() {
    return `
    <div class="bg-gradient-to-b from-gray-900 to-gray-800 rounded-2xl shadow-lg p-6">
        <h3 class="text-lg font-semibold text-white mb-4" id="TaskStatusProgress">Trạng thái nhiệm vụ</h3>
        <canvas id="statusChart" height="200"></canvas>
    </div>`;
}

function createChart2() {
    return `
    <div class="bg-gradient-to-b from-gray-900 to-gray-800 rounded-2xl shadow-lg p-6">
        <h3 class="text-lg font-semibold text-white mb-4">Phân bố tiến độ dự án</h3>
        <canvas id="progressChart" height="200"></canvas>
    </div>`;
}

// --- Render Cột trái ---
function createLeftColumnHeader() {
    const x = -1, y = -1; // Giữ nguyên ID đặc biệt của bạn
    return `
    <div class="flex justify-between items-center mb-4">
        <h2 class="text-md font-semibold text-white">Dự án & Nhiệm vụ</h2>
        <div class="flex gap-3">
            <div class="relative flex items-center">
                <input type="text" id="searchInput"
                       placeholder="Tìm kiếm..."
                       class="bg-gray-800 text-white text-xs pl-9 pr-3 py-2 rounded-lg border border-gray-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 outline-none transition w-60" />
                <i data-lucide="search"
                   class="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"></i>
            </div>
            <button id="add-project-btn" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-medium transition flex items-center gap-1">
                <i data-lucide="folder-plus" class="w-4 h-4"></i> Thêm dự án
            </button>
            <button id="add-task-btn" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-xs font-medium transition flex items-center gap-1">
                <i data-lucide="list-plus" class="w-4 h-4"></i> Thêm nhiệm vụ
            </button>
        </div>
    </div>`;
}

function createControlButtons() {
    return `
    <div class="flex justify-end mb-2 gap-[10px]">
        <div class="relative group cursor-pointer">
             <div class="flex items-center gap-3 bg-gray-800/80 border-2 border-red-600 rounded-lg px-2 py-2 cursor-pointer hover:bg-red-600/10 transition-all duration-300 shadow-sm group">
                <label for="priorityHigh" class="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" id="priorityHigh" class="hidden peer" />
                    <span class="w-4 h-4 border-2 border-gray-500 rounded peer-checked:bg-red-500 peer-checked:border-red-500 transition-all"></span>
                </label>
                <label for="priorityHigh" class="flex items-center gap-2 text-red-400 font-medium cursor-pointer select-none">
                    <i data-lucide="alert-triangle" class="w-4 h-4 text-red-400 group-hover:text-red-300 transition-all"></i>
                    <span class="text-xs group-hover:text-red-300">Ưu tiên cao</span>
                </label>
            </div>
            <span class="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full mr-2
                         bg-gray-900 text-white text-xs rounded-md px-2 py-1 opacity-0 scale-90
                         group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 whitespace-nowrap shadow-lg">
                Chọn để lọc nhiệm vụ có độ ưu tiên cao
            </span>
        </div>

        <button id="toggleAllBtn"
                class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition flex items-center gap-1">
            <i data-lucide="chevron-down" class="w-4 h-4"></i>
            <span class="text-xs">Mở tất cả</span>
        </button>
    </div>`;
}

function createViewProjectNull() {
    return `
    <div class="text-center py-10 text-gray-400 text-lg bg-gray-900/50 rounded-lg flex flex-col items-center justify-center gap-3">
        <i data-lucide="folder-x" class="w-[80px] h-[80px] text-gray-500"></i>
        <span>Hiện chưa có dự án nào.</span>
    </div>`;
}

function createViewTaskNull() {
    return `
    <div class="flex flex-col items-center justify-center py-8 bg-gray-900/80 rounded-xl border border-gray-700/50">
        <div class="p-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 shadow-md">
            <i data-lucide="folder-x" class="w-5 h-5 text-indigo-500"></i>
        </div>
        <span class="text-xs text-gray-400">Không có nhiệm vụ nào!</span>
    </div>`;
}

// --- Render Project (Chỉ render "vỏ") ---
function createProjectView(p) {
    const projectCover = `
    <div class="flex justify-between items-center p-4 gap-[20px] cursor-pointer hover:bg-gray-700 transition"
         data-toggle="project#${p.idProject}">
        <div class="w-full">
            <div class="flex items-center justify-between w-full gap-[20px]">
                <div class="flex items-center gap-[5px]">
                    <i data-lucide="chevron-right" class="w-5 h-5 text-gray-400 transition-transform duration-300" style="transform: rotate(0deg);"></i>
                    <h3 class="font-semibold text-md text-white">
                        ${p.projectName}
                    </h3>
                </div>
            </div>
            <div class="mt-5 flex align-items-center gap-3">
                <div class="flex gap-1 items-center  bg-gray-700/50 px-4 py-1.5 rounded-full">
                    <i data-lucide="circle-user-round" class="w-4 h-4 text-white"></i>
                    <span class="text-xs">${p.manager ?? "Unknown"}</span>
                </div>
                <div class="flex gap-1 items-center  bg-green-900/50 px-4 py-1.5 rounded-full">
                    <i data-lucide="calendar" class="w-4 h-4 text-white"></i>
                    <span class="text-xs">
                        ${p.startDay ? new Date(p.startDay).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "--/--/----"}
                    </span>
                </div>
                <div class="flex gap-1 items-center  bg-red-900/50 px-4 py-1.5 rounded-full ">
                    <i data-lucide="calendar-check" class="w-4 h-4 text-white"></i>
                    <span class="text-xs">
                        ${p.endDay ? new Date(p.endDay).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "--/--/----"}
                    </span>
                </div>
            </div>
        </div>
    </div>`;

    return `
    <div class="project-card bg-gray-800 /*border border-gray-700*/ rounded-xl overflow-hidden" data-page-loaded="${currentPage}">
        ${projectCover}
        <div id="project#${p.idProject}" class="overflow-hidden transition-all duration-500 ease-in-out" style="max-height: 0px;">
            <div class="p-4 border-t border-gray-700 bg-gray-900/60">
                <div class="mb-4 p-3 rounded-lg bg-gradient-to-r from-indigo-600/20 to-purple-600/10 border border-indigo-500/30">
                    <div class="flex items-center justify-between mb-1">
                        <h4 class="text-white text-sm font-semibold flex items-center gap-2">
                            <i data-lucide="file-text" class="w-4 h-4 text-indigo-400"></i>
                            Mô tả dự án
                        </h4>
                        <div class="flex items-center gap-2 relative">
                            ${p.fileNote && p.fileNote.trim() !== "" ? `
                            <button class="flex items-center gap-2 text-xs text-indigo-300 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-400/40 rounded-lg px-3 py-1.5 transition-all"
                                    onclick="downloadFile('${p.fileNote}')">
                                <i data-lucide='download' class='w-3 h-3'></i> Tải xuống
                            </button>
                            <button class="flex items-center gap-2 text-xs text-indigo-300 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-400/40 rounded-lg px-3 py-1.5 transition-all"
                                    onclick="viewFile('${p.fileNote}')">
                                <i data-lucide='eye' class='w-3 h-3'></i> Xem
                            </button>`
            : ""}
                            <button id="addFileBtn#${p.idProject}" data-project="${p.idProject}" class="flex items-center gap-2 text-xs text-green-300 bg-green-600/20 hover:bg-green-600/40 border border-green-400/40 rounded-lg px-3 py-1.5 transition-all">
                                <i data-lucide='plus' class='w-3 h-3'></i> Thêm file
                            </button>
                        </div>
                    </div>
                    <p class="text-gray-300 text-sm leading-relaxed">${p.note}</p>
                </div>

                <div class="task-list-placeholder max-h-[420px] overflow-y-auto overflow-x-hidden scroll-smooth custom-scroll"
                     data-project-id="${p.idProject}"
                     data-loaded="false">
                    </div>
            </div>
        </div>
    </div>`;
}

// --- Render Task (khi được gọi) ---
function createTaskView(t) {
    let priorityBorder = "";
    switch (t.priority.toLowerCase()) {
        case "high":
            priorityBorder = "border-red-900";
            break;
        default:
            priorityBorder = "border-gray-700";
            break;
    }

    return `
    <div class="task-card border-l-[2px] ${priorityBorder} p-4 ml-[50px] rounded-bl-[10px] transition transform duration-300"
         data-project-id="${t.projectId}"
         data-priority="${t.priority.toLowerCase()}">
        
        <div class="flex justify-between items-center">
            <h2 class="font-semibold text-white text-sm">${t.nameTask}</h2>
            <div class="relative group">
                <button id="openUpdateTaskBtn#${t.projectId}#${t.idTask}"
                        onclick="this.blur()"
                        class="p-2 rounded-full bg-gray-800 hover:bg-indigo-600 transition-all shadow-md hover:shadow-lg focus:outline-none focus:ring-0"
                        data-task='${JSON.stringify(t)}'>
                    <i data-lucide="bolt" class="w-4 h-4 text-gray-300"></i>
                </button>
                <span class="absolute z-20 left-1/2 -top-[-1px] -translate-x-[8rem] bg-gray-900 text-white text-xs rounded-md px-2 py-1 opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 whitespace-nowrap shadow-lg">
                    Xem chi tiết
                </span>
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
                        <div class="flex justify-end gap-[10px] bg-gray-900">
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

        <div class="flex flex-row justify-between items-center w-full">
            <div class="flex justify-start gap-3 items-center text-sm text-gray-400">
                <div class="flex flex-wrap gap-2">
                    ${renderLabel(t.statusName, t.overdue)}
                </div>
                <span class="text-gray-400">•</span>
                <div class="relative group cursor-pointer text-xs">
                    <div class="flex gap-1 items-center">
                        <i data-lucide="circle-user-round" class="w-4 h-4 text-white"></i>
                        <span>${t.nameAssignee ?? "Chưa có"}</span>
                    </div>
                    <span class="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs rounded-md px-2 py-1 opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 whitespace-nowrap shadow-lg">
                        Người thực hiện
                    </span>
                </div>
                <span class="text-gray-400">•</span>
                <div class="relative group cursor-pointer text-xs">
                    <div class="flex gap-1 items-center">
                        <i data-lucide="calendar" class="w-4 h-4 text-green-600"></i>
                        <span class="">
                            ${t.startDate ? new Date(t.startDate).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "--/--/----"}
                        </span>
                    </div>
                    <span class="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs rounded-md px-2 py-1 opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 whitespace-nowrap shadow-lg">
                        Thời gian bắt đầu
                    </span>
                </div>
                <span class="text-gray-400">•</span>
                <div class="relative group cursor-pointer text-xs">
                    <div class="flex gap-1 items-center">
                        <i data-lucide="calendar-check" class="w-4 h-4 text-red-600"></i>
                        <span>
                            ${t.endDate ? new Date(t.endDate).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "--/--/----"}
                        </span>
                    </div>
                    <span class="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs rounded-md px-2 py-1 opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 whitespace-nowrap shadow-lg">
                        Thời gian hết hạn
                    </span>
                </div>
            </div>
        </div>
    </div>`;
}

// =================================================================
// 7. CÁC HÀM HELPER (KHÔNG THAY ĐỔI NHIỀU)
// =================================================================

// Helper tải phòng ban (cache)
async function loadDepartments() {
    try {
        const deptRes = await fetch("/api/departments");
        allDepartmentsData = await deptRes.json();
    } catch (e) {
        console.error("Lỗi tải departments:", e);
    }
}

// Helper render biểu đồ
function renderStatusChart(notStarted, inProgress, completed, overdue) {
    const ctx1 = document.getElementById("statusChart").getContext("2d");
    new Chart(ctx1, {
        type: "doughnut",
        data: {
            labels: ["Chưa triển khai", "Đang thực hiện", "Hoàn thành", "Quá hạn"],
            datasets: [{
                data: [notStarted, inProgress, completed, overdue],
                backgroundColor: ["#333", "#3b82f6", "#22c55e", "#ef4444"],
                borderWidth: 0,
            }],
        },
        options: {
            cutout: "50%",
            plugins: {
                legend: {
                    position: "bottom",
                    labels: { color: "#d1d5db", boxWidth: 12, padding: 15 },
                },
                datalabels: {
                    color: "#fff",
                    font: { size: 14, weight: "bold" },
                    formatter: (value, ctx) => {
                        const dataArr = ctx.chart.data.datasets[0].data;
                        const sum = dataArr.reduce((a, b) => a + b, 0);
                        if (sum === 0 || value === 0) return "";
                        return ((value / sum) * 100).toFixed(1) + "%";
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
                    if (total === 0) {
                        ctx.fillText("Không có dữ liệu", width / 2, height / 2.2);
                    }
                    content.textContent = `Trạng thái nhiệm vụ`;
                    ctx.save();
                },
            },
        ],
    });
}

function renderProgressChart(countToDo, countInProgress, countDone, countOverdue) {
    const ctx2 = document.getElementById("progressChart").getContext("2d");
    new Chart(ctx2, {
        type: "bar",
        data: {
            labels: ["ToDo", "InProgress", "Done", "Overdue"],
            datasets: [{
                label: "Số lượng dự án",
                data: [countToDo, countInProgress, countDone, countOverdue],
                backgroundColor: ["#eab308", "#3b82f6", "#22c55e", "#ef4444"],
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
}

// Helper render label (không đổi)
function renderLabel(status, isOverdue) {
    let statusText = "";
    let statusClass = "";
    switch ((status || "").toString().toLowerCase()) {
        case "1":
            statusText = "CHƯA BẮT ĐẦU";
            statusClass = isOverdue ? "bg-red-900/40 text-white border-red-900" : "bg-gray-700/40 text-gray-300 border-gray-600";
            break;
        case "2":
            statusText = "ĐANG THỰC HIỆN";
            statusClass = isOverdue ? "bg-red-900/40 text-white border-red-900" : "bg-blue-900/40 text-blue-400 border-blue-900";
            break;
        case "3":
            statusText = "HOÀN THÀNH";
            statusClass = isOverdue ? "bg-red-900/40 text-white border-red-900" : "bg-green-900/40 text-green-400 border-green-900";
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
    return `<span class="px-4 inline-flex items-center rounded-full border text-[10px] ${statusClass}">${statusText}</span>`;
}

// Helper DOM update (không đổi)
async function renderAfterDOMUpdate(callback) {
    await new Promise(requestAnimationFrame);
    callback();
}

// Helper fetch members (không đổi)
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
        return await res.json();
    } catch (err) {
        console.error("❌ Fetch members error:", err);
        return [];
    }
}

// =================================================================
// 8. LOGIC MODAL (ĐÃ SỬA LỖI STATUS)
// =================================================================

// SỬA LỖI: <select> cho Status phải dùng value "1", "2", "3"
function formTask(task = null, projects = []) {
    let renderOptionProject = ``;
    let startDate = "";
    let endDate = "";

    if (task) {
        startDate = task.startDate ? new Date(task.startDate).toLocaleDateString("en-CA") : "";
        endDate = task.endDate ? new Date(task.endDate).toLocaleDateString("en-CA") : "";
    }

    if (Array.isArray(projects)) {
        projects.forEach(p => {
            renderOptionProject += `
            <option value="${p.idProject}" ${task && p.idProject == task.projectId ? "selected" : ""}>
                ${p.projectName}
            </option>`;
        });
    }

    const assigneeDisabled = task === null ? "disabled" : "";

    return (`
    ${loading}
    <div id="updateTaskModal" class="fixed inset-0 flex items-center justify-center hidden z-40 overflow-hidden">
        <div class="bg-gray-900 w-[700px] rounded-2xl shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-gray-700 relative animate-fadeIn max-h-[83vh] flex flex-col">
            <div class="sticky top-0 bg-gray-900 z-10 px-8 pt-6 pb-4 border-b border-gray-800 flex justify-between items-center rounded-tl-2xl rounded-tr-2xl">
                <h3 class="text-xl font-semibold text-white flex items-center gap-2">
                    <i data-lucide="edit-3" class="w-6 h-6 text-indigo-400"></i>
                    Nhiệm vụ
                </h3>
                <button id="closeUpdateTaskBtn" class="text-gray-400 hover:text-white transition">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>
            </div>

            <div class="px-8 pb-8 overflow-y-auto custom-scroll">
                <form id="updateTaskForm" class="flex flex-col gap-6 mt-4">
                    <div class="flex flex-col sm:flex-row gap-4">
                        <div class="flex-1">
                            <label class="block text-xs text-gray-300 mb-2">Tên nhiệm vụ</label>
                            <input id="taskName"
                                   value="${task?.nameTask ?? ""}"
                                   type="text"
                                   required
                                   class="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                   placeholder="Nhập tên task..." />
                        </div>

                        <div class="flex-1">
                            <label class="block text-xs text-gray-300 mb-2 font-medium">Dự án</label>
                            <div id="projectOptions" class="relative group ">
                                <select id="project"
                                    required
                                    ${!task ? "" : "disabled"} class="appearance-none w-full px-4 text-xs py-2 rounded-lg bg-gray-800/80 border border-gray-700 text-gray-200 font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all hover:bg-gray-800/90 cursor-pointer">
                                    <option value="">---Chọn dự án---</option>
                                    ${renderOptionProject}
                                </select>
                                <div class="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400">
                                    <i data-lucide="chevron-down" class="w-4 h-4"></i>
                                </div>
                            </div>
                        </div>
                    </div>

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
                            <ul id="userSuggestions"
                                class="absolute z-50 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg text-white text-sm hidden
                                       max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-indigo-600 scrollbar-track-gray-700">
                            </ul>
                        </div>
                    </div>

                    <div>
                        <label class="block text-xs text-gray-300 mb-2">Mô tả</label>
                        <textarea id="taskDesc"
                                  rows="4"
                                  class="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                                  placeholder="Nhập mô tả...">${task?.note ?? ""}</textarea>
                    </div>

                    <div class="flex flex-col sm:flex-row gap-4">
                        <div class="flex-1 relative">
                            <label class="block text-xs text-gray-300 mb-1">Ngày bắt đầu</label>
                            <input id="taskStart"
                                   type="date"
                                   required
                                   value="${startDate}"
                                   class="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none appearance-none pr-10" />
                            <i data-lucide="calendar" class="absolute cursor-pointer right-10 top-7 text-gray-400 pointer-events-none w-4 h-4"></i>
                        </div>
                        <div class="flex-1 relative">
                            <label class="block text-xs text-gray-300 mb-1">Ngày kết thúc</label>
                            <input id="taskEnd"
                                   type="date"
                                   required
                                   value="${endDate}"
                                   class="w-full px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none appearance-none pr-10" />
                            <i data-lucide="calendar" class="absolute cursor-pointer right-10 top-7 text-gray-400 pointer-events-none w-4 h-4"></i>
                        </div>
                    </div>

                    <div class="flex flex-col sm:flex-row gap-4">
                        <div class="flex-1">
                            <label class="block text-xs text-gray-300 mb-2 font-medium">Trạng thái</label>
                            <div class="relative group">
                                <select id="taskStatus" class="appearance-none w-full px-4 text-xs py-2.5 rounded-xl bg-gray-800/80 border border-gray-700 text-gray-200 font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all hover:bg-gray-800/90 cursor-pointer">
                                    <option value="status-todo" ${task?.statusName == "1" ? "selected" : ""}>Chưa bắt đầu</option>
                                    <option value="status-inprogress" ${task?.statusName == "2" ? "selected" : ""}>Đang thực hiện</option>
                                    <option value="status-done" ${task?.statusName == "3" ? "selected" : ""}>Hoàn thành</option>
                                </select>
                                <div class="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400">
                                    <i data-lucide="chevron-down" class="w-4 h-4"></i>
                                </div>
                            </div>
                        </div>
                        <div class="flex-1">
                            <label class="block text-xs text-gray-300 mb-2 font-medium">Độ ưu tiên</label>
                            <div class="relative group">
                                <select id="taskPriority" class="appearance-none w-full px-4 text-xs py-2.5 rounded-xl bg-gray-800/80 border border-gray-700 text-gray-200 font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all hover:bg-gray-800/90 cursor-pointer">
                                    <option value="low" ${task?.priority == "low" ? "selected" : ""}>Thấp</option>
                                    <option value="medium" ${task?.priority == "medium" ? "selected" : ""}>Trung bình</option>
                                    <option value="high" ${task?.priority == "high" ? "selected" : ""}>Cao</option>
                                </select>
                                <div class="absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400">
                                    <i data-lucide="chevron-down" class="w-4 h-4"></i>
                                </div>
                            </div>
                        </div>
                    </div>

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
                                       class="hidden"
                                       accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xls,.xlsx" />
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

                    <div class="flex justify-end mt-4 gap-2">
                        <button id="deleteBtn" type="button" ${task ? "" : "disabled"}
                                class="px-8 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white text-xs font-medium shadow-md transition-all">
                            Xóa
                        </button>
                        <button type="submit" id="confirmUploadBtn"
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

// Logic mở modal (không đổi nhiều, thêm logic fetch members)
async function openTaskModal(task = null, projects) {
    const uploadOverlay = document.getElementById(`uploadOverlay`);
    uploadOverlay.classList.remove("hidden");

    // Tạo modal HTML (dùng projects từ cache)
    const modalHTML = formTask(task, projects);

    let existingModal = document.getElementById("updateTaskModal");
    if (existingModal) existingModal.remove();
    document.body.insertAdjacentHTML("beforeend", modalHTML);

    const modal = document.getElementById("updateTaskModal");
    modal.classList.remove("hidden");

    // Gắn các event cho modal
    handleFilePreviewEdit();
    handleConfirm(task);
    if (task) {
        handleDelete(task.idTask);
    }

    lucide.createIcons();
    closeFormModal(); // Gắn event đóng modal

    // Xử lý logic load member
    var members = [];
    const projectSelect = document.getElementById("project");
    const assigneeInput = document.getElementById("taskAssignee");

    if (task && task.projectId) {
        // Trường hợp EDIT: Tải member của project đã chọn
        members = await fetchMemberByProject(task.projectId);
        addAssigneee(members);
    } else {
        // Trường hợp ADD NEW: Gắn event cho select project
        projectSelect.addEventListener("change", async (e) => {
            const projectId = e.target.value;
            assigneeInput.value = ""; // Reset
            assigneeInput.setAttribute("disabled", true);

            if (!projectId) return;

            members = await fetchMemberByProject(projectId);
            if (members && members.length > 0) {
                assigneeInput.removeAttribute("disabled");
                addAssigneee(members);
            }
        });
    }
}

// SỬA LỖI: Lấy đúng StatusId ("1", "2", "3")
function getUpdatedTaskFromForm(oldTask = {}) {
    const name = document.getElementById("taskName")?.value.trim() || "";
    const description = document.getElementById("taskDesc")?.value.trim() || "";
    const startDate = document.getElementById("taskStart")?.value || "";
    const endDate = document.getElementById("taskEnd")?.value || "";
    const projectId = document.getElementById("project")?.value || "";
    const memberId = document.getElementById("taskAssigneeId")?.value || null;
    const status = document.getElementById("taskStatus")?.value || ""; // SỬA: Lấy value "1", "2", "3"
    const prior = document.getElementById("taskPriority")?.value || "";
    const file = document.getElementById("existingFileUrl")?.value || "";

    const t = {
        ...oldTask,
        Id: (oldTask && oldTask.idTask) ? oldTask.idTask : crypto.randomUUID(), // Sửa: check oldTask.idTask
        Name: name,
        Prior: prior,
        File: file,
        Desc: description,
        Start: startDate,
        End: endDate,
        IdAss: memberId,
        IdPrj: projectId,
        Status: status, // SỬA: Gửi "1", "2", "3"
    }
    return t;
}

// Các hàm xử lý modal (không đổi)
function handleFilePreviewEdit() {
    const fileInput = document.getElementById("fileInputEdit");
    const previewContainer = document.getElementById("previewContainerEdit");
    const fileNameLabel = document.getElementById("fileNameEdit");
    const hiddenInput = document.getElementById("existingFileUrl");
    const dropZone = document.getElementById("dropZone");
    if (!fileInput || !previewContainer) return;
    fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        previewContainer.innerHTML = "";
        if (file) {
            fileNameLabel.textContent = file.name;
            const fileURL = URL.createObjectURL(file);
            hiddenInput.value = fileURL;
            const ext = file.name.split(".").pop().toLowerCase();
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
                previewContainer.innerHTML = `<p class="text-sm text-gray-300 flex items-center gap-2"><i data-lucide="file"></i> ${file.name}</p>`;
                lucide.createIcons();
            }
        } else {
            fileNameLabel.textContent = hiddenInput.value ? hiddenInput.value.split("/").pop() : "";
        }
    });
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
            fileInput.files = e.dataTransfer.files;
            fileInput.dispatchEvent(new Event("change"));
        }
    });
    const existing = hiddenInput.value;
    if (existing) {
        const ext = existing.split(".").pop().toLowerCase();
        fileNameLabel.textContent = existing.split("/").pop();
        if (["png", "jpg", "jpeg", "gif"].includes(ext)) {
            previewContainer.innerHTML = `<img src="${existing}" class="max-h-[180px] rounded-lg object-contain" />`;
        } else if (["pdf"].includes(ext)) {
            previewContainer.innerHTML = `<iframe src="${existing}" class="w-full h-[180px] rounded-lg"></iframe>`;
        } else {
            previewContainer.innerHTML = `<p class="text-sm text-gray-300 flex items-center gap-2"><i data-lucide="file"></i> ${existing.split("/").pop()}</p>`;
            lucide.createIcons();
        }
    }
}
function addAssigneee(members) {
    const input = document.getElementById("taskAssignee");
    const suggestionBox = document.getElementById("userSuggestions");
    const hiddenId = document.getElementById("taskAssigneeId");
    let hasSelected = false;
    input.addEventListener("input", () => {
        const value = input.value.trim();
        hasSelected = false;
        if (value.startsWith("@")) {
            const keyword = value.substring(1).toLowerCase();
            const filtered = members.filter(m => m.fullname.toLowerCase().includes(keyword));
            if (filtered.length > 0) {
                suggestionBox.innerHTML = filtered.map(m => `<li data-id="${m.id}" class="px-3 py-1.5 hover:bg-indigo-600 cursor-pointer rounded-md transition">${m.fullname}</li>`).join("");
                suggestionBox.classList.remove("hidden");
            } else {
                suggestionBox.classList.add("hidden");
            }
        } else {
            suggestionBox.classList.add("hidden");
        }
    });
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
    input.addEventListener("blur", () => {
        setTimeout(() => {
            if (!hasSelected) {
                input.value = "";
                hiddenId.value = "";
            }
            suggestionBox.classList.add("hidden");
        }, 200);
    });
}

function closeFormModal() {
    const closeBtn = document.getElementById("closeUpdateTaskBtn");
    const modal = document.getElementById("updateTaskModal");
    const uploadOverlay = document.getElementById(`uploadOverlay`);

    const closeModal = () => {
        modal.classList.add("hidden");
        uploadOverlay.classList.add("hidden");
        setTimeout(() => modal.remove(), 300);
        document.removeEventListener('keydown', onEsc); // Dọn dẹp
    };

    const onEsc = (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    };

    closeBtn.addEventListener("click", closeModal);
    document.addEventListener('keydown', onEsc);
}
function handleConfirm(task) {
    const form = document.getElementById("updateTaskForm");
    form.addEventListener("submit", async (e) => { // Nghe sự kiện submit của form
        e.preventDefault(); // Ngăn form reload

        const updatedTask = getUpdatedTaskFromForm(task);
        console.log("Dữ liệu mới:", updatedTask);

        const loadingOverlay = document.getElementById(`loadingOverlay`);
        loadingOverlay.classList.remove("hidden");

        try {
            const res = await fetch("/Home/SaveTask", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updatedTask)
            });

            const data = await res.json();

            if (data.success) {
                // Đóng modal
                const modal = document.getElementById("updateTaskModal");
                if (modal) {
                    modal.querySelector("#closeUpdateTaskBtn").click();
                }
                // Tải lại toàn bộ dashboard để cập nhật
                // TODO: Tối ưu hơn bằng cách chỉ tải lại phần bị ảnh hưởng (ví dụ: chỉ tải lại project đó)
                location.reload();
            } else {
                alert("❌ Lưu thất bại: " + (data.message || "Không rõ lỗi"));
                loadingOverlay.classList.add("hidden");
            }
        } catch (e) {
            loadingOverlay.classList.add("hidden");
            console.error("🔥 Lỗi gửi dữ liệu:", e);
            alert("Có lỗi xảy ra khi gửi dữ liệu!");
        }
    });
}
function handleDelete(taskId) {
    const deleteBtn = document.getElementById("deleteBtn");
    deleteBtn.addEventListener("click", async () => {
        const overlay = document.getElementById("loadingOverlay");

        if (!taskId) {
            alert("⚠️ Không tìm thấy ID task để xóa!");
            return;
        }

        if (!confirm("Bạn có chắc muốn xóa task này không?")) return;

        overlay.classList.remove("hidden");

        try {
            const res = await fetch(`/Home/DeleteTask?id=${taskId}`, { method: "DELETE" });
            const data = await res.json();

            console.log("[1324]: "+data);

            if (data.success) {
                const modal = document.getElementById("updateTaskModal");
                if (modal) {
                    modal.querySelector("#closeUpdateTaskBtn").click();
                }
                location.reload(); // Tải lại
            } else {
                console.log("❌ " + data.message);
                overlay.classList.add("hidden");
            }
        } catch (e) {
            overlay.classList.add("hidden");
            console.error("🔥 Lỗi khi xóa task:", e);
            alert("⚠️ Không thể xóa task. Kiểm tra lại kết nối hoặc server.");
        }
    });
}

// Các hàm toggle/filter (không đổi)
function toggleAllProjects() {
    const toggleAllBtn = document.getElementById("toggleAllBtn");
    if (!toggleAllBtn) return;

    // 1. SỬA LỖI LOGIC: Trạng thái ban đầu là ĐANG ĐÓNG
    let allOpen = false;

    // 2. SỬA UX: Biến hàm này thành ASYNC để xử lý lazy-load
    toggleAllBtn.addEventListener("click", async () => {

        // 3. Vô hiệu hóa nút để tránh click nhiều lần
        toggleAllBtn.disabled = true;

        const projectToggleButtons = document.querySelectorAll("[data-toggle]");

        // Tạo một danh sách các "lời hứa" sẽ tải dữ liệu
        const loadingPromises = [];

        projectToggleButtons.forEach(btn => {
            const isOpen = btn.classList.contains("open");

            if (allOpen && isOpen) {
                // Trạng thái là "Mở", ta muốn "Thu"
                // Thu lại thì rất nhanh, gọi trực tiếp
                handleProjectToggle(btn);
            } else if (!allOpen && !isOpen) {
                // Trạng thái là "Thu", ta muốn "Mở"
                // Đây là hành động ASYNC, thêm nó vào danh sách chờ
                loadingPromises.push(handleProjectToggle(btn));
            }
        });

        // 4. KIỂM TRA: Nếu có bất kỳ project nào cần MỞ (và tải dữ liệu)
        if (loadingPromises.length > 0) {
            // Đặt nút ở trạng thái "Đang tải..."
            toggleAllBtn.innerHTML = `
                <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span class="text-xs">Đang tải...</span>`;

            // Chờ cho TẤT CẢ các project tải xong
            await Promise.all(loadingPromises);
        }

        // 5. SAU KHI MỌI THỨ HOÀN TẤT:

        // Đảo ngược trạng thái
        allOpen = !allOpen;

        // Cập nhật lại nút
        toggleAllBtn.innerHTML = allOpen
            ? `<i data-lucide="chevron-up" class="w-4 h-4"></i> <span class="text-xs">Thu gọn tất cả</span>`
            : `<i data-lucide="chevron-down" class="w-4 h-4"></i> <span class="text-xs">Mở tất cả</span>`;
        lucide.createIcons();

        // Kích hoạt lại nút
        toggleAllBtn.disabled = false;
    });
}
function filterHighPriorHome() {
    //const checkbox = document.getElementById("priorityHigh");
    //if (!checkbox) return;

    //checkbox.addEventListener("change", function () {
    //    const showHighOnly = checkbox.checked;
    //    const taskCards = document.querySelectorAll(".task-card"); // Phải query lại

    //    console.log("[1391]: ", taskCards);
    //    taskCards.forEach(card => {
    //        const priority = card.dataset.priority?.toLowerCase();
    //        const isHigh = (priority === "cao" || priority === "high");

    //        if (showHighOnly && !isHigh) {
    //            card.style.display = "none";
    //        } else {
    //            card.style.display = "block";
    //        }
    //    });
    //});
    const checkbox = document.getElementById("priorityHigh");
    if (!checkbox) return;

    checkbox.addEventListener("change", function () {
        // 1. Cập nhật trạng thái toàn cục
        isPriorityFilterActive = checkbox.checked;

        // 2. Lọc tất cả các task-card HIỆN CÓ trên trang
        const allTaskCards = document.querySelectorAll(".task-card");
        allTaskCards.forEach(card => {
            applyPriorityFilterToCard(card);
        });
    });
}

// (Hàm helper mới) Áp dụng logic lọc cho 1 card
function applyPriorityFilterToCard(card) {
    const priority = card.dataset.priority?.toLowerCase();
    const isHigh = (priority === "cao" || priority === "high");

    if (isPriorityFilterActive && !isHigh) {
        card.style.display = "none";
    } else {
        card.style.display = "block";
    }
}

// Các hàm download/view file (Tạm giả định)
function downloadFile(fileUrl) {
    if (!fileUrl) return;
    alert(`Đang tải file: ${fileUrl}`);
    // window.open(fileUrl, '_blank');
}
function viewFile(fileUrl) {
    if (!fileUrl) return;
    alert(`Đang xem file: ${fileUrl}`);
    // TODO: Mở bằng Google Docs Viewer hoặc PDF.js
}