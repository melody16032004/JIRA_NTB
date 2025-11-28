// ===============================
// -----| /js/calendar.js |-------
// ===============================
document.addEventListener("DOMContentLoaded", () => {

    // ==============================
    // 1. STATE MANAGEMENT & VARS
    // ==============================
    let isDataLoaded = false;   // Cờ: Đã tải dữ liệu chưa?
    let isLoading = false;      // Cờ: Đang tải dữ liệu?

    // Biến lưu dữ liệu toàn cục trong scope này
    let calendarItems = {};
    let allCalendarItemsFlat = [];
    let taskDeadline = [];
    let projectDeadline = [];
    let currentDate = new Date(); // Tháng đang hiển thị

    // ==============================
    // 2. DOM ELEMENTS
    // ==============================
    const btn = document.getElementById("calendarButton");
    const popup = document.getElementById("calendarPopup");
    const daysContainer = document.getElementById("calendarDays");
    const selectMonth = document.getElementById("selectMonth");
    const selectYear = document.getElementById("selectYear");
    const prev = document.getElementById("prevMonth");
    const next = document.getElementById("nextMonth");
    const summaryContainer = document.getElementById("calendarSummary");
    const taskDetailContainer = document.getElementById("task-detail");
    const calendarHeader = document.getElementById("calendar-header");
    const weekHeader = taskDetailContainer?.previousElementSibling; // Dùng optional chaining cho an toàn

    // Helper pad số 0
    const pad = n => n.toString().padStart(2, "0");

    // ==============================
    // 3. HELPER FUNCTIONS (Logic)
    // ==============================

    function parseDateLocal(dateString) {
        if (!dateString) return null;
        const simpleDateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (simpleDateRegex.test(dateString)) {
            const [y, m, d] = dateString.split("-").map(s => parseInt(s, 10));
            if (!y || !m || !d) return null;
            return new Date(y, m - 1, d);
        }
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return null;
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    function getKeyLocalFromDateObj(dateObj) {
        return `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`;
    }

    async function safeFetchJson(url, fallback = []) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (err) {
            console.warn("Fetch failed:", url, err);
            return fallback;
        }
    }

    function getDiffText(diffDays) {
        if (diffDays === 0) return "Hôm nay";
        if (diffDays === 1) return "Ngày mai";
        if (diffDays === 2) return "Ngày mốt";
        if (diffDays < 0) return `Đã qua ${-diffDays} ngày`;
        return `${diffDays} ngày tới`;
    }

    function getStatusInfo(item, diffDays) {
        let statusText = "Chờ";
        let statusColor = "text-yellow-400";
        let isOverdue = false;

        if (item.statusName == 3) {
            statusText = "Hoàn thành";
            statusColor = "text-green-400";
        } else if (diffDays < 0) {
            statusText = "Quá hạn";
            statusColor = "text-red-400";
            isOverdue = true;
        } else if (item.statusName == 2) {
            statusText = "Thực hiện";
            statusColor = "text-blue-400";
        }
        return { statusText, statusColor, isOverdue };
    }

    // ==============================
    // 4. CORE: LOAD DATA (LAZY)
    // ==============================
    async function initCalendarData() {
        if (isDataLoaded) return; // Nếu đã có dữ liệu thì thoát

        try {
            // A. Kiểm tra và fetch User (me) nếu chưa có
            // Giả sử biến 'me' được định nghĩa ở global scope (window.me) hoặc file js khác.
            // Nếu chưa có, ta fetch tại đây.
            if (typeof me === 'undefined' || !me) {
                const meRes = await fetch("/api/user/me");
                if (meRes.ok) {
                    window.me = await meRes.json(); // Gán vào window để dùng chung
                }
            }

            if (!window.me) {
                window.location.href = "/Error/403";
                return;
            }

            // B. Fetch Tasks và Projects
            const [fetchedTasks, fetchedProjects] = await Promise.all([
                safeFetchJson("/api/tasks/deadline", []),
                safeFetchJson("/api/projects/deadline", [])
            ]);

            taskDeadline = fetchedTasks;
            projectDeadline = fetchedProjects;

            // C. Xử lý dữ liệu vào calendarItems map
            const pushItem = (key, item) => {
                if (!key) return;
                if (!calendarItems[key]) calendarItems[key] = [];
                calendarItems[key].push(item);
            };

            (taskDeadline || []).forEach(t => {
                const d = parseDateLocal(t.endDate);
                if (!d) return;
                const key = getKeyLocalFromDateObj(d);
                pushItem(key, { ...t, type: "task", _parsedDate: d });
            });

            (projectDeadline || []).forEach(p => {
                const d = parseDateLocal(p.endDay);
                if (!d) return;
                const key = getKeyLocalFromDateObj(d);
                pushItem(key, { ...p, type: "project", _parsedDate: d });
            });

            allCalendarItemsFlat = Object.values(calendarItems).flat();
            isDataLoaded = true; // Đánh dấu hoàn tất

        } catch (e) {
            console.error("Lỗi khởi tạo dữ liệu lịch:", e);
        }
    }

    // ==============================
    // 5. API ACTIONS (UPDATE STATUS)
    // ==============================
    async function updateItemStatus(item, newStatus) {
        const isTask = item.type === 'task';
        const id = isTask ? item.idTask : item.idProject;

        const taskUrlMap = {
            1: `/api/task/${id}/status/todo`,
            2: `/api/task/${id}/status/inprogress`,
            3: `/api/task/${id}/status/done`
        };
        const projectUrlMap = {
            1: `/api/project/${id}/status/todo`,
            2: `/api/project/${id}/status/inprogress`,
            3: `/api/project/${id}/status/done`
        };

        const url = isTask ? taskUrlMap[newStatus] : projectUrlMap[newStatus];
        if (!url) return false;

        const buttons = taskDetailContainer.querySelectorAll('.status-toggle-btn');
        buttons.forEach(b => b.disabled = true);

        try {
            const res = await fetch(url, { method: 'PATCH' });
            if (!res.ok) throw new Error(await res.text() || res.statusText);

            // Gửi thông báo nếu có Leader
            if (window.me && window.me.leaderId) {
                try {
                    await fetch("/api/notification/push", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            UserId: window.me.leaderId,
                            Title: `Cập nhật trạng thái công việc`,
                            Message: `${window.me.fullName} vừa cập nhật trạng thái: ${item.nameTask || item.projectName}`
                        })
                    });
                } catch (notifyErr) { console.error("Notify error:", notifyErr); }
            }

            buttons.forEach(b => b.disabled = false);
            return true;

        } catch (err) {
            console.error("Update status error:", err);
            alert("Lỗi cập nhật trạng thái.");
            buttons.forEach(b => b.disabled = false);
            return false;
        }
    }

    // ==============================
    // 6. UI RENDER FUNCTIONS
    // ==============================

    function populateMonthSelector() {
        const months = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
            "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];
        selectMonth.innerHTML = months.map((m, i) => `<option value="${i}">${m}</option>`).join("");
    }

    function populateYearSelector(centerYear) {
        const years = [];
        for (let i = centerYear - 5; i <= centerYear + 5; i++) {
            years.push(`<option value="${i}">${i}</option>`);
        }
        selectYear.innerHTML = years.join("");
    }

    function showTaskDetail(item) {
        if (!item) return;

        daysContainer.classList.add('hidden');
        calendarHeader.classList.add('hidden');
        if (weekHeader) weekHeader.classList.add('hidden');
        taskDetailContainer.classList.remove('hidden');

        const todayMidnight = new Date(new Date().setHours(0, 0, 0, 0));
        const endMidnight = item._parsedDate;
        const diffDays = Math.ceil((endMidnight - todayMidnight) / (1000 * 60 * 60 * 24));
        const { statusText, statusColor, isOverdue } = getStatusInfo(item, diffDays);

        const isTask = item.type === 'task';
        const name = isTask ? (item.nameTask || "Task") : (item.projectName || "Project");
        const person = item.fullName || "N/A";
        const personLabel = isTask ? "Thực hiện:" : "Quản lý:";
        const endDate = isTask ? item.endDate : item.endDay;
        const dateString = endDate ? new Date(parseDateLocal(endDate)).toLocaleDateString('vi-VN') : "N/A";
        const isOver = diffDays < 0;

        const detailHtml = `
            <div class="flex items-center gap-2 mb-3 cursor-pointer text-indigo-400 hover:text-indigo-300 transition-colors w-fit" id="btnBackToCalendar">
                <i data-lucide="arrow-left" class="w-4 h-4"></i>
                <span class="text-xs font-medium">Quay lại lịch</span>
            </div>
            <div class="p-4 bg-gray-800/60 rounded-xl border border-gray-700 text-left space-y-3 shadow-inner">
                <div class="flex items-center justify-between">
                    <h4 class="font-bold text-base text-white leading-tight">${name}</h4>
                    ${isOverdue || isOver ? `` : `
                    <div id="status-action" class="flex items-center bg-gray-800 rounded-lg p-1 gap-1">
                        <button data-status="1" class="status-toggle-btn flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all ${item.statusName === 1 ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'}" title="Chờ"><i data-lucide="concierge-bell" class="w-3 h-3"></i></button>
                        <button data-status="2" class="status-toggle-btn flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all ${item.statusName === 2 ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'}" title="Thực hiện"><i data-lucide="activity" class="w-3 h-3"></i></button>
                        <button data-status="3" class="status-toggle-btn flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all ${item.statusName === 3 ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'}" title="Đã xong"><i data-lucide="check" class="w-3 h-3"></i></button>
                    </div>`}
                </div>
                <div class="text-sm text-gray-300 flex flex-col gap-1">
                    <div class="flex justify-between">
                        <span class="font-medium text-gray-400">${personLabel}</span>
                        <span>${person}</span>
                    </div>
                    ${isTask ? `<div class="flex justify-between"><span class="font-medium text-gray-400">Dự án:</span><span class="italic text-gray-200">${item.projectName || "N/A"}</span></div>` : ''}
                </div>
                <div class="flex items-center justify-between pt-3 border-t border-gray-700/50">
                    <div class="text-xs text-gray-400">
                        <span class="block font-medium">Hạn chót:</span>
                        <span class="text-gray-200 text-sm">${dateString}</span>
                    </div>
                    <div id="detail-status-badge" class="text-xs font-bold px-2 py-1 rounded bg-gray-900/50 border border-gray-700 ${statusColor}">${statusText}</div>
                </div>
            </div>
        `;

        taskDetailContainer.innerHTML = detailHtml;
        if (typeof lucide !== 'undefined') lucide.createIcons();

        // Sự kiện Quay lại
        document.getElementById('btnBackToCalendar').addEventListener('click', () => {
            taskDetailContainer.classList.add('hidden');
            daysContainer.classList.remove('hidden');
            calendarHeader.classList.remove('hidden');
            if (weekHeader) weekHeader.classList.remove('hidden');
        });

        // Sự kiện đổi status
        const statusButtons = taskDetailContainer.querySelectorAll('.status-toggle-btn');
        statusButtons.forEach(btn => {
            btn.addEventListener('click', async () => {
                const newStatus = parseInt(btn.dataset.status, 10);
                if (newStatus === item.statusName) return;

                const success = await updateItemStatus(item, newStatus);
                if (success) {
                    item.statusName = newStatus;
                    // Cập nhật UI ngay lập tức
                    statusButtons.forEach(b => {
                        b.classList.remove('bg-indigo-600', 'text-white', 'shadow-sm');
                        b.classList.add('text-gray-400', 'hover:text-white');
                    });
                    btn.classList.add('bg-indigo-600', 'text-white', 'shadow-sm');
                    btn.classList.remove('text-gray-400', 'hover:text-white');

                    const newInfo = getStatusInfo(item, diffDays);
                    const badge = document.getElementById('detail-status-badge');
                    if (badge) {
                        badge.className = `text-xs font-bold px-2 py-1 rounded bg-gray-900/50 border border-gray-700 ${newInfo.statusColor}`;
                        badge.textContent = newInfo.statusText;
                    }

                    if (newStatus === 3) {
                        const actionDiv = document.getElementById('status-action');
                        if (actionDiv) actionDiv.classList.add('hidden');
                    }

                    // Render lại lịch để đồng bộ màu chấm/border
                    const today = new Date();
                    const tm = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                    renderSummary(tm);
                    renderCalendar(currentDate);
                }
            });
        });
    }

    function renderSummary(todayMidnight, filterDate = null) {
        const alerts = [];
        let noDataMessage = "";

        if (filterDate) {
            const key = getKeyLocalFromDateObj(filterDate);
            const itemsForDay = calendarItems[key] || [];
            itemsForDay.forEach(item => {
                const endLocal = item._parsedDate;
                const endMidnight = new Date(endLocal.getFullYear(), endLocal.getMonth(), endLocal.getDate());
                const diffDays = Math.ceil((endMidnight - todayMidnight) / (1000 * 60 * 60 * 24));
                alerts.push({ ...item, diffDays });
            });
            const dateString = filterDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
            noDataMessage = `
                <div class="w-full flex flex-col items-center justify-center py-8">
                    <i data-lucide="message-circle-warning" class="w-5 h-5"></i>
                    <div class="text-sm text-center text-gray-500 py-2">Không có deadline ngày ${dateString}</div>
                </div>`;
        } else {
            // Mặc định: Hôm nay, Mai, Mốt
            const allItems = Object.values(calendarItems).flat();
            allItems.forEach(item => {
                const endLocal = item._parsedDate;
                if (!endLocal) return;
                const endMidnight = new Date(endLocal.getFullYear(), endLocal.getMonth(), endLocal.getDate());
                const diffDays = Math.ceil((endMidnight - todayMidnight) / (1000 * 60 * 60 * 24));
                if (diffDays >= 0 && diffDays <= 2) {
                    alerts.push({ ...item, diffDays });
                }
            });
            noDataMessage = `
                <div class="w-full flex flex-col items-center justify-center gap-1 py-4 md:py-8">
                    <i data-lucide="check-circle-2" class="w-4 h-4 md:w-5 md:h-5 text-gray-500"></i>
                    <div class="text-xs md:text-sm text-center text-gray-500 mt-2">Không có việc nào sắp/quá hạn</div>
                </div>`;
        }

        alerts.sort((a, b) => {
            const a_done = (a.statusName == 3);
            const b_done = (b.statusName == 3);
            if (a_done && !b_done) return 1;
            if (!a_done && b_done) return -1;
            return a.diffDays - b.diffDays;
        });

        if (alerts.length === 0) {
            summaryContainer.innerHTML = noDataMessage;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        summaryContainer.innerHTML = alerts.map(item => {
            const { statusColor } = getStatusInfo(item, item.diffDays);
            const text = getDiffText(item.diffDays);
            const icon = (item.type === 'task'
                ? (item.statusName == 3 ? 'check-square' : 'square')
                : (item.statusName == 3 ? 'folder-check' : 'folder'));
            const name = item.type === 'task' ? (item.nameTask || "Task") : (item.projectName || "Project");

            return `
            <div class="summary-item-clickable flex flex-col items-start justify-start p-1 rounded-md hover:bg-gray-700 transition cursor-pointer"
                 data-item-id="${item.idTask || item.idProject}"
                 data-item-type="${item.type}">
                <div class="flex items-center justify-between text-sm w-full">
                    <div class="flex items-center overflow-hidden min-w-0">
                        <i data-lucide="${icon}" class="w-4 h-4 mr-2 flex-shrink-0 ${statusColor}"></i>
                        <span class="truncate ${statusColor} text-xs">${name}</span>
                    </div>
                    <span class="flex-shrink-0 text-[10px] text-gray-400 ml-2 ${statusColor}">${text}</span>
                </div>
                <div class="flex items-center justify-between w-full">
                    ${item.type === 'task' ? `<span class="text-[10px] pl-6 text-gray-400 italic truncate max-w-[60%]">${item.projectName}</span>` : ``}
                    <span class="text-[10px] pl-6 text-gray-200 italic truncate ml-auto">${item.fullName || ""}</span>
                </div>
            </div>`;
        }).join("");

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function renderCalendar(date) {
        const year = date.getFullYear();
        const month = date.getMonth();

        populateYearSelector(year);
        selectMonth.value = month;
        selectYear.value = year;

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDay = (firstDay.getDay() + 6) % 7;

        daysContainer.innerHTML = "";

        // Fill blanks
        for (let i = 0; i < startDay; i++) {
            daysContainer.appendChild(document.createElement("div"));
        }

        const today = new Date();
        const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        // Reset views
        taskDetailContainer.innerHTML = '';
        taskDetailContainer.classList.add('hidden');
        daysContainer.classList.remove('hidden');
        if (weekHeader) weekHeader.classList.remove('hidden');
        if (calendarHeader) calendarHeader.classList.remove('hidden');

        // Render summary (Hôm nay/Mai/Mốt)
        renderSummary(todayMidnight);

        // Render Days
        for (let i = 1; i <= lastDay.getDate(); i++) {
            const day = document.createElement("div");
            day.className = "relative p-2 rounded-full hover:bg-indigo-500 hover:text-white cursor-pointer transition-all";
            day.textContent = i;

            const isToday = i === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            if (isToday) day.classList.add("bg-indigo-700", "text-white", "font-bold");

            const keyDate = new Date(year, month, i);
            const key = getKeyLocalFromDateObj(keyDate);
            const allItems = calendarItems[key] || [];

            const tasks = allItems.filter(it => it.type === 'task' && it.statusName != 3 && it.statusName != 4);
            const projects = allItems.filter(it => it.type === 'project' && it.statusName != 3 && it.statusName != 4);

            // Logic hiển thị Border (Project)
            if (projects.length > 0) {
                day.classList.add("border-2", "box-border");
                const item = projects[0];
                const endLocal = item._parsedDate;
                const endMidnight = new Date(endLocal.getFullYear(), endLocal.getMonth(), endLocal.getDate());
                const diffDays = Math.ceil((endMidnight - todayMidnight) / (1000 * 60 * 60 * 24));
                const { statusColor } = getStatusInfo(item, diffDays);

                if (statusColor.includes('green')) day.classList.add("border-green-500");
                else if (statusColor.includes('red')) day.classList.add("border-red-500");
                else if (statusColor.includes('yellow')) day.classList.add("border-yellow-400");
                else day.classList.add("border-blue-500");
            }

            // Logic hiển thị Dot (Task)
            if (tasks.length > 0) {
                const maxDots = Math.min(tasks.length, 1);
                for (let j = 0; j < maxDots; j++) {
                    const item = tasks[j];
                    const dot = document.createElement("div");
                    const offset = (j - (maxDots - 1) / 2) * 6;
                    dot.style.left = `calc(50% + ${offset}px)`;
                    dot.style.transform = "translateX(-50%)";
                    dot.className = "absolute bottom-0.7 w-1.5 h-1.5 rounded-full";

                    const endLocal = item._parsedDate;
                    const endMidnight = new Date(endLocal.getFullYear(), endLocal.getMonth(), endLocal.getDate());
                    const diffDays = Math.ceil((endMidnight - todayMidnight) / (1000 * 60 * 60 * 24));
                    const { statusColor } = getStatusInfo(item, diffDays);

                    if (statusColor.includes('green')) dot.classList.add("bg-green-500");
                    else if (statusColor.includes('red')) dot.classList.add("bg-red-500");
                    else if (statusColor.includes('yellow')) dot.classList.add("bg-yellow-400");
                    else dot.classList.add("bg-blue-500");

                    day.appendChild(dot);
                }
                if (tasks.length > 3) {
                    const more = document.createElement("div");
                    more.textContent = `+${tasks.length - 1}`;
                    more.className = "absolute text-[10px] bottom-5 right-3 text-green-400";
                    day.appendChild(more);
                }
            }

            // Sự kiện Click vào ngày
            day.addEventListener("click", (e) => {
                e.stopPropagation();
                // Reset detail view
                taskDetailContainer.innerHTML = '';
                taskDetailContainer.classList.add('hidden');
                daysContainer.classList.remove('hidden');
                if (weekHeader) weekHeader.classList.remove('hidden');
                if (calendarHeader) calendarHeader.classList.remove('hidden');

                // Render Summary cho ngày đó
                renderSummary(todayMidnight, keyDate);

                // Highlight selected day
                const currentlySelected = daysContainer.querySelector('.day-selected');
                if (currentlySelected) {
                    currentlySelected.classList.remove('day-selected');
                    if (!currentlySelected.classList.contains('bg-indigo-700')) {
                        currentlySelected.classList.remove('bg-indigo-500', 'text-white');
                    }
                }
                day.classList.add('day-selected');
                if (!isToday) {
                    day.classList.add('bg-indigo-500', 'text-white');
                }
            });

            daysContainer.appendChild(day);
        }
    }

    // ==============================
    // 7. EVENT LISTENERS
    // ==============================

    // --- SỬA ĐỔI QUAN TRỌNG NHẤT: TOGGLE & LAZY LOAD ---
    btn.addEventListener("click", async (e) => {
        e.stopPropagation();

        // 1. Nếu đang loading thì chặn
        if (isLoading) return;

        // 2. Nếu chưa tải data, tải ngay bây giờ
        if (!isDataLoaded) {
            isLoading = true;
            // Hiệu ứng loading trên nút
            const oldContent = btn.innerHTML;
            btn.innerHTML = `<i data-lucide="loader-2" class="animate-spin w-5 h-5"></i>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            btn.disabled = true;

            await initCalendarData(); // GỌI API

            isLoading = false;
            btn.disabled = false;
            btn.innerHTML = oldContent;
            if (typeof lucide !== 'undefined') lucide.createIcons();

            // Dữ liệu đã về, render lại lịch để hiện các chấm
            currentDate = new Date();
            renderCalendar(currentDate);
        }

        // 3. Logic Toggle Popup như cũ
        const wasHidden = popup.classList.contains("hidden");
        popup.classList.toggle("hidden");
        if (wasHidden) {
            // Mở ra: Đảm bảo hiển thị đúng tháng hiện tại
            // (Nếu không muốn reset về tháng hiện tại mỗi lần mở, bỏ dòng dưới)
            // renderCalendar(currentDate); 
        }
    });

    prev.addEventListener("click", (e) => {
        e.stopPropagation();
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar(currentDate);
    });

    next.addEventListener("click", (e) => {
        e.stopPropagation();
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar(currentDate);
    });

    // Click outside -> Hide
    document.addEventListener("click", (e) => {
        if (!popup.contains(e.target) && !btn.contains(e.target)) {
            popup.classList.add("hidden");
        }
    });

    function handleSelectChange() {
        const newYear = parseInt(selectYear.value, 10);
        const newMonth = parseInt(selectMonth.value, 10);
        currentDate = new Date(newYear, newMonth, 1);
        renderCalendar(currentDate);
    }

    selectMonth.addEventListener("change", handleSelectChange);
    selectYear.addEventListener("change", handleSelectChange);

    summaryContainer.addEventListener('click', function (e) {
        const itemEl = e.target.closest('.summary-item-clickable');
        if (!itemEl) return;
        e.stopPropagation();
        const id = itemEl.dataset.itemId;
        const type = itemEl.dataset.itemType;
        const item = allCalendarItemsFlat.find(it =>
            it.type === type && (it.idTask === id || it.idProject === id)
        );
        if (item) showTaskDetail(item);
    });

    // ==============================
    // 8. INITIALIZATION
    // ==============================
    populateMonthSelector();
    // Render lần đầu (Rỗng, chưa call API)
    renderCalendar(currentDate);
});