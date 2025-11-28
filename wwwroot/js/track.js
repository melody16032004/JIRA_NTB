/* =========================================== */
/* ======= TRACK.JS - ASSIGNEE GANTT ========= */
/* =========================================== */

// --- STATE CỦA GANTT CHART ---
let assigneeGanttChart = null;
let ganttExpandedUsers = new Set();
let currentLoadedTasks = [];
let totalAssigneeUsers = 0;
let ganttCurrentPageIndex = 1;
const GANTT_USER_PAGE_SIZE = 5;
let ganttDepartmentFilterId = '';
let currentProjectDepartmentFilter = 'all';
let currentUserPageIndex = 1;
const USER_PAGE_SIZE = 5;
let allTasks = [];
let isDeptChange = false;
let isReloadGantt = false;
let role = document.body.getAttribute('data-user-role');
/**
 * Hàm trả về HTML String cho khung chứa Gantt Chart
 */
function getGanttChartHTML() {
    return `
    <div id="assignee-gantt-container" class="w-full bg-gray-800 rounded-2xl shadow-lg border border-gray-700 p-4 relative min-h-[550px] overflow-hidden">
        <div class="flex justify-between items-center mb-4">
            <div class="flex items-center gap-3">
                <h3 class="text-lg font-semibold text-white flex items-center gap-2">
                    <i data-lucide="users" class="w-5 h-5 text-indigo-400"></i>
                    Tiến độ theo nhân sự
                </h3>
            </div>
            <div class="flex items-center gap-2">
                <select id="gantt-department-filter" class="${role == "ADMIN" ? "" : "hidden"} bg-gray-700 text-gray-300 text-xs rounded-lg px-2 py-1.5 border border-gray-600 focus:border-indigo-500 outline-none transition mr-2">
                </select>

                <button id="gantt-prev" class="p-1.5 rounded hover:bg-gray-600 text-gray-400 hover:text-white transition" title="Trang trước">
                    <i data-lucide="chevron-left" class="w-4 h-4 text-white"></i>
                </button>
                <button id="gantt-next" class="p-1.5 rounded hover:bg-gray-600 text-gray-400 hover:text-white transition" title="Trang sau">
                    <i data-lucide="chevron-right" class="w-4 h-4 text-white"></i>
                </button>
                <div class="w-[1px] h-4 bg-gray-600 mx-1"></div>
                <button id="gantt-check" class="p-1.5 rounded hover:bg-gray-600 text-gray-400 hover:text-white transition" title="Hiện tên task">
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

        <div id="assignee-gantt-scroll-wrapper" class="max-h-[550px] overflow-y-auto custom-scroll pr-2">
            <div id="assignee-gantt-chart"></div>
        </div>
        
        <div id="gantt-loader" class="absolute inset-0 flex flex-col items-center justify-center bg-gray-800/90 z-10 hidden">
            <svg class="animate-spin w-8 h-8 text-indigo-500 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
            </svg>
            <span class="text-gray-400 text-sm">Đang tải dữ liệu...</span>
        </div>
    </div>
    `;
}
async function safeFetchJson(url, fallback = []) {
    try {
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) {
        console.warn("Fetch failed:", url, err);
        return fallback;
    }
}
// ============================================================
// HÀM CHÍNH
// ============================================================
async function renderAssigneeGantt() {
    const chartEl = document.querySelector("#assignee-gantt-chart");
    const loaderEl = document.querySelector("#gantt-loader");
    const deptSelect = document.getElementById("gantt-department-filter");
    const btnPrev = document.getElementById("gantt-prev");
    const btnNext = document.getElementById("gantt-next");

    if (!chartEl) {
        if (loaderEl) loaderEl.innerHTML = '<span class="text-gray-500">Không có dữ liệu dự án.</span>';
        return;
    }

    if (loaderEl) loaderEl.classList.remove("hidden");

    if (btnPrev) btnPrev.disabled = true;
    if (btnNext) btnNext.disabled = true;

    try {
        if (deptSelect && !deptSelect.hasAttribute('data-loaded')) {
            deptSelect.innerHTML = '<option value="">Tất cả phòng ban</option>';
            try {
                const depts = await safeFetchJson(`/api/departments/list`, []);
                depts.forEach(d => {
                    const option = document.createElement("option");
                    option.value = d.idDepartment;
                    option.textContent = d.departmentName;
                    if (d.idDepartment == ganttDepartmentFilterId) option.selected = true;
                    deptSelect.appendChild(option);
                });
            } catch (err) { console.error("Lỗi load phòng ban Gantt", err); }

            deptSelect.setAttribute('data-loaded', 'true');

            deptSelect.onchange = async (e) => {
                ganttDepartmentFilterId = e.target.value;
                ganttCurrentPageIndex = 1;
                if (assigneeGanttChart) {
                    assigneeGanttChart.destroy();
                    assigneeGanttChart = null;
                }
                chartEl.innerHTML = "";
                isDeptChange = true;
                await renderAssigneeGantt();
            };
        }

        const url = `/api/tasks/all?pageIndex=1&pageSize=15&departmentId=${ganttDepartmentFilterId}`;

        if (allTasks.length === 0 || isDeptChange || isReloadGantt) {
            const response = await safeFetchJson(url, { items: [] });
            const safeResponse = (response && typeof response === "object") ? response : { items: [] };
            allTasks = Array.isArray(safeResponse.items) ? safeResponse.items : [];
            totalAssigneeUsers = response.totalUsers || 0;
            if (isDeptChange) isDeptChange = false;
            if (isReloadGantt) isReloadGantt = false;
        }

        if (btnPrev) {
            btnPrev.disabled = currentUserPageIndex <= 1;
            btnPrev.onclick = () => {
                if (currentUserPageIndex > 1) {
                    currentUserPageIndex--;
                    renderAssigneeGantt();
                }
            };
        }
        if (btnNext) {
            const maxPage = Math.ceil(totalAssigneeUsers / USER_PAGE_SIZE);
            btnNext.disabled = currentUserPageIndex >= maxPage;
            btnNext.onclick = () => {
                if (currentUserPageIndex < maxPage) {
                    currentUserPageIndex++;
                    renderAssigneeGantt();
                }
            };
        }

        if (allTasks.length === 0) {
            if (loaderEl) loaderEl.classList.add("hidden");
            if (assigneeGanttChart) {
                assigneeGanttChart.destroy();
                assigneeGanttChart = null;
            }
            chartEl.innerHTML = `
                <div class="flex flex-col items-center justify-center h-[280px] text-gray-500 border-2 border-dashed border-gray-700 rounded-xl bg-gray-800/30">
                    <div class="p-4 rounded-full bg-gray-800 mb-3 shadow-sm">
                        <i data-lucide="clipboard-list" class="w-10 h-10 text-indigo-400 opacity-80"></i>
                    </div>
                    <span class="font-medium">Chưa có nhiệm vụ nào</span>
                    <span class="text-xs text-gray-500 mt-1">Các dự án hiện tại chưa có task nào được tạo.</span>
                </div>`;
            lucide.createIcons();
            return;
        } else {
            if (!assigneeGanttChart) chartEl.innerHTML = "";
        }

        updateGanttChartUI(false); // Mặc định hiện label
        attachGanttToolbarEvents(chartEl);

    } catch (e) {
        console.error("Lỗi vẽ Gantt Chart:", e);
        if (loaderEl) loaderEl.innerHTML = '<span class="text-red-500 text-sm">Lỗi tải dữ liệu biểu đồ.</span>';
    } finally {
        if (loaderEl) loaderEl.classList.add("hidden");
        setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 300);
    }
}

/**
 * Hàm Logic xử lý dữ liệu và cấu hình ApexCharts
 */
function updateGanttChartUI(isLabelShown = false) {
    const chartEl = document.querySelector("#assignee-gantt-chart");
    if (!chartEl) return;

    const tasksByUser = {};
    let minDate = new Date().getTime();
    let maxDate = new Date().getTime();
    let hasData = false;

    allTasks.forEach(t => {
        hasData = true;
        const assignee = t.nameAssignee || "Chưa phân công";
        if (!tasksByUser[assignee]) tasksByUser[assignee] = [];

        let color = '#3B82F6';
        if (assignee === "Chưa phân công") {
            color = '#6366F1';
        } else {
            if (t.statusName === 1) color = '#6B7280';
            if (t.statusName === 3) color = '#10B981';
            if (t.overdue) color = '#EF4444';
        }

        const startDateObj = new Date(t.startDate);
        const endDateObj = new Date(t.endDate);
        startDateObj.setHours(0, 0, 0, 0);
        endDateObj.setHours(23, 59, 59, 999);

        if (startDateObj.getTime() > endDateObj.getTime()) {
            endDateObj.setTime(startDateObj.getTime());
        }

        const start = startDateObj.getTime();
        const end = endDateObj.getTime();

        if (!hasData || start < minDate) minDate = start;
        if (!hasData || end > maxDate) maxDate = end;

        tasksByUser[assignee].push({
            userKey: assignee,
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

    if (!hasData) {
        minDate = new Date().getTime();
        maxDate = new Date().getTime() + 86400000;
    }

    const VIEW_RANGE_DAYS = 16;
    const msInDay = 24 * 60 * 60 * 1000;
    const DAYS_BEFORE_TODAY = 2;
    const currentViewDuration = VIEW_RANGE_DAYS * msInDay;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();
    let viewMinDate = todayTime - (DAYS_BEFORE_TODAY * msInDay);
    let viewMaxDate = viewMinDate + (VIEW_RANGE_DAYS * msInDay);
    const tickCount = VIEW_RANGE_DAYS;

    let userKeys = Object.keys(tasksByUser);
    userKeys.sort((a, b) => {
        if (a === "Chưa phân công") return -1;
        if (b === "Chưa phân công") return 1;
        return a.localeCompare(b, 'vi', { sensitivity: 'base' });
    });

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
                t.x = `${user}__${index}`;
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

    const dynamicHeight = Math.max(380, userKeys.length * 60);

    // FIX LỖI: Hủy biểu đồ cũ trước khi vẽ lại
    if (assigneeGanttChart) {
        assigneeGanttChart.destroy();
        assigneeGanttChart = null;
    }
    chartEl.innerHTML = "";

    const options = {
        series: [{ name: 'Tasks', data: seriesData }],
        chart: {
            height: dynamicHeight,
            type: 'rangeBar',
            background: 'transparent',
            animations: { enabled: false },
            zoom: { enabled: true, type: 'x', autoScaleYaxis: false },
            toolbar: { show: true, autoSelected: 'pan', tools: { selection: false, zoom: false, zoomin: false, zoomout: false, download: true, pan: true, reset: true } },
            events: {
                dataPointSelection: function (event, chartContext, config) {
                    const dataPoint = config.w.config.series[config.seriesIndex].data[config.dataPointIndex];
                    const userKey = dataPoint.userKey;
                    if (userKey) {
                        if (ganttExpandedUsers.has(userKey)) ganttExpandedUsers.delete(userKey);
                        else ganttExpandedUsers.add(userKey);

                        // FIX LỖI: Dùng setTimeout để đảm bảo event hiện tại chạy xong trước khi destroy chart
                        setTimeout(() => {
                            updateGanttChartUI(isLabelShown);
                        }, 0);
                    }
                },
                scrolled: function (chartContext, { xaxis }) {
                    if (!xaxis) return;
                    if (chartContext.snapTimeout) clearTimeout(chartContext.snapTimeout);
                    chartContext.snapTimeout = setTimeout(() => {
                        const date = new Date(xaxis.min);
                        if (date.getHours() >= 12) date.setDate(date.getDate() + 1);
                        date.setHours(0, 0, 0, 0);
                        const snappedMin = date.getTime();
                        if (Math.abs(xaxis.min - snappedMin) > 60000) {
                            chartContext.zoomX(snappedMin, snappedMin + currentViewDuration);
                        }
                    }, 100);
                }
            }
        },
        plotOptions: {
            bar: { horizontal: true, barHeight: '60%', rangeBarGroupRows: true, borderRadius: 4 }
        },
        dataLabels: {
            enabled: isLabelShown,
            textAnchor: 'middle',
            style: { colors: ['#fff'], fontSize: '11px', fontWeight: '600' },
            formatter: (val, opt) => opt.w.config.series[opt.seriesIndex].data[opt.dataPointIndex].meta.taskName
        },
        stroke: { width: 1, colors: ['#fff'] },
        fill: { type: 'solid', opacity: 0.8 },
        annotations: {
            xaxis: [{
                x: new Date().getTime(), strokeDashArray: 4, borderColor: '#F43F5E', borderWidth: 2,
                label: { borderColor: '#F43F5E', style: { color: '#fff', background: '#F43F5E', fontSize: '12px', fontWeight: 'bold' }, text: 'Hôm nay' }
            }]
        },
        xaxis: {
            type: 'datetime', min: viewMinDate, max: viewMaxDate, tickAmount: tickCount,
            labels: { rotate: -10, style: { colors: '#9CA3AF' }, formatter: (val) => new Date(val).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) },
            tooltip: { enabled: false }
        },
        yaxis: {
            labels: {
                align: 'left', style: { colors: labelColors, fontSize: '13px', fontWeight: 600 }, offsetX: -10, minWidth: 150, maxWidth: 150,
                formatter: (val) => {
                    if (String(val).includes('__')) {
                        const [user, idx] = String(val).split('__');
                        return parseInt(idx) === 0 ? `[-] ${user}` : ``;
                    }
                    return `[+] ${val}`;
                }
            }
        },
        grid: { borderColor: '#374151', xaxis: { lines: { show: true } }, yaxis: { lines: { show: true } } },
        theme: { mode: 'dark' },
        tooltip: {
            custom: function ({ series, seriesIndex, dataPointIndex, w }) {
                const data = w.globals.initialSeries[seriesIndex].data[dataPointIndex];
                return `
                    <div class="px-3 py-2 bg-gray-900 border border-gray-600 rounded shadow-lg z-50 text-left">
                        <div class="text-xs text-gray-400 mb-1 truncate max-w-[200px]">${data.meta.projectName}</div>
                        <div class="text-sm font-bold text-white mb-1">${data.meta.taskName}</div>
                        <div class="text-xs text-indigo-300 font-mono mt-1">📅 ${data.meta.s.toLocaleDateString('vi-VN')} - ${data.meta.e.toLocaleDateString('vi-VN')}</div>
                    </div>
                `;
            }
        }
    };

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
}

function attachGanttToolbarEvents(chartEl) {
    const checkBtn = document.getElementById('gantt-check');
    const reloadBtn = document.getElementById('gantt-reload');
    const expandBtn = document.getElementById('gantt-expand');
    const scrollWrapper = document.getElementById('assignee-gantt-scroll-wrapper');

    if (checkBtn) {
        const newBtn = checkBtn.cloneNode(true);
        checkBtn.parentNode.replaceChild(newBtn, checkBtn);
        let isLabelsOn = false;
        if (assigneeGanttChart && assigneeGanttChart.w && assigneeGanttChart.w.config.dataLabels.enabled) {
            isLabelsOn = true;
        }
        newBtn.innerHTML = isLabelsOn ? '<i data-lucide="eye" class="w-4 h-4 text-white"></i>' : '<i data-lucide="eye-closed" class="w-4 h-4 text-white"></i>';

        newBtn.addEventListener('click', () => {
            isLabelsOn = !isLabelsOn;
            updateGanttChartUI(isLabelsOn);
            newBtn.innerHTML = isLabelsOn ? '<i data-lucide="eye" class="w-4 h-4 text-white"></i>' : '<i data-lucide="eye-closed" class="w-4 h-4 text-white"></i>';
            if (window.lucide) lucide.createIcons();
        });
    }

    if (reloadBtn) {
        const newBtn = reloadBtn.cloneNode(true);
        reloadBtn.parentNode.replaceChild(newBtn, reloadBtn);

        newBtn.addEventListener('click', async () => {
            isReloadGantt = true;
            await renderAssigneeGantt();
        });
    }

    if (expandBtn && scrollWrapper) {
        const newBtn = expandBtn.cloneNode(true);
        expandBtn.parentNode.replaceChild(newBtn, expandBtn);
        let isExpanded = scrollWrapper.classList.contains("max-h-[85vh]");
        newBtn.innerHTML = isExpanded ? '<i data-lucide="minimize-2" class="w-4 h-4 text-white"></i>' : '<i data-lucide="maximize-2" class="w-4 h-4 text-white"></i>';

        newBtn.addEventListener('click', () => {
            isExpanded = !isExpanded;
            if (isExpanded) {
                scrollWrapper.classList.remove("max-h-[280px]");
                scrollWrapper.classList.add("max-h-[85vh]");
                newBtn.setAttribute("title", "Thu gọn");
                newBtn.innerHTML = '<i data-lucide="minimize-2" class="w-4 h-4 text-white"></i>';
            } else {
                scrollWrapper.classList.remove("max-h-[85vh]");
                scrollWrapper.classList.add("max-h-[280px]");
                newBtn.setAttribute("title", "Mở rộng");
                newBtn.innerHTML = '<i data-lucide="maximize-2" class="w-4 h-4 text-white"></i>';
            }
            if (window.lucide) lucide.createIcons();
        });
    }
}