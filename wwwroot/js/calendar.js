// ===============================
// -----| /js/calendar.js |-------
// ===============================
document.addEventListener("DOMContentLoaded", async () => {
    // ==============================
    // ========== Calendar ==========
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
    const weekHeader = taskDetailContainer.previousElementSibling;

    // helper
    const pad = n => n.toString().padStart(2, "0");

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

    // safe fetch
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

    // load remote data
    const [taskDeadline, projectDeadline] = await Promise.all([
        safeFetchJson("/api/tasks/deadline", []),
        safeFetchJson("/api/projects/deadline", [])
    ]);

    console.log("Task/deadline: ", taskDeadline);
    console.log("Project/deadline: ", projectDeadline);

    // build calendarItems map: { 'YYYY-MM-DD': [items...] }
    const calendarItems = {};

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

    const allCalendarItemsFlat = Object.values(calendarItems).flat();
    // current shown month (local)
    let currentDate = new Date();

    // ======================================================
    // MỚI: CÁC HÀM ĐIỀN THÁNG/NĂM
    // ======================================================

    function populateMonthSelector() {
        const months = [
            "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
            "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"
        ];
        selectMonth.innerHTML = months.map((month, index) => {
            return `<option value="${index}">${month}</option>`;
        }).join("");
    }

    function populateYearSelector(centerYear) {
        const years = [];
        // Lấy 5 năm trước và 5 năm sau
        for (let i = centerYear - 5; i <= centerYear + 5; i++) {
            years.push(`<option value="${i}">${i}</option>`);
        }
        selectYear.innerHTML = years.join("");
    }

    // ======================================================
    // MỚI: HÀM HELPER ĐỂ HIỂN THỊ TEXT THÔNG BÁO
    // ======================================================
    function getDiffText(diffDays) {
        // SỬA: Bỏ logic quá hạn
        if (diffDays === 0) return "Hôm nay";
        if (diffDays === 1) return "Ngày mai";
        if (diffDays === 2) return "Ngày mốt"; // SỬA: Thêm ngày mốt
        if (diffDays < 0) return `Đã qua ${-diffDays} ngày`;
        return `${diffDays} ngày tới`; // Trường hợp dự phòng
    }

    // ======================================================
    // MỚI: HÀM HELPER TÍNH TRẠNG THÁI
    // ======================================================
    /**
     * Trả về text, màu, và trạng thái quá hạn
     * (Giả sử: 1: Chờ, 2: Thực hiện, 3: Đã xong)
     */
    function getStatusInfo(item, diffDays) {
        let statusText = "Chờ";
        let statusColor = "text-yellow-400"; // Màu cho 'Chờ' (status 1)
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
            statusColor = "text-blue-400"; // Màu cho 'Thực hiện' (status 2)
        }
        // (Nếu là status 1 và không quá hạn, nó sẽ giữ nguyên 'Chờ')

        return { statusText, statusColor, isOverdue };
    }

    // ======================================================
    // SỬA: HÀM GỌI API CẬP NHẬT STATUS (Hỗ trợ Task & Project)
    // ======================================================
    async function updateItemStatus(item, newStatus) {
        const isTask = item.type === 'task';
        const id = isTask ? item.idTask : item.idProject;

        // 1. Map status (1,2,3) sang URL
        // (Giả sử 1: Todo, 2: InProgress, 3: Done)
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

        // 2. Chọn URL dựa trên type
        const url = isTask ? taskUrlMap[newStatus] : projectUrlMap[newStatus];

        if (!url) {
            console.error("Trạng thái không hợp lệ:", newStatus);
            return false;
        }

        // 3. Vô hiệu hóa nút
        const buttons = taskDetailContainer.querySelectorAll('.status-toggle-btn');
        buttons.forEach(b => b.disabled = true);

        console.log(`Đang PATCH ${item.type} [${id}] sang status ${newStatus} tại URL ${url}`);

        // 4. Gọi API
        try {
            const res = await fetch(url, {
                method: 'PATCH', // Dùng PATCH
            });

            if (!res.ok) throw new Error(await res.text() || res.statusText);

            buttons.forEach(b => b.disabled = false);
            return true;

        } catch (err) {
            console.error("Lỗi cập nhật status:", err);
            alert("Không thể cập nhật trạng thái. Vui lòng thử lại.");
            buttons.forEach(b => b.disabled = false);
            return false;
        }
    }


    // ======================================================
    // SỬA: HÀM HIỂN THỊ CHI TIẾT (ẨN LỊCH, HIỆN CHI TIẾT)
    // ======================================================
    function showTaskDetail(item) {
        if (!item) return;

        // 1. Ẩn Lịch và Header Thứ
        daysContainer.classList.add('hidden');
        calendarHeader.classList.add('hidden');
        if (weekHeader) weekHeader.classList.add('hidden');

        // 2. Hiện container chi tiết
        taskDetailContainer.classList.remove('hidden');

        // 3. Tính toán thông tin hiển thị
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
        // 4. Tạo HTML (với ID cho badge và data-status cho nút)
        const detailHtml = `
            <div class="flex items-center gap-2 mb-3 cursor-pointer text-indigo-400 hover:text-indigo-300 transition-colors w-fit" id="btnBackToCalendar">
                <i data-lucide="arrow-left" class="w-4 h-4"></i>
                <span class="text-xs font-medium">Quay lại lịch</span>
            </div>

            <div class="p-4 bg-gray-800/60 rounded-xl  border border-gray-700 text-left space-y-3 shadow-inner">
                <div class="flex items-center justify-between">
                    <h4 class="font-bold text-base text-white leading-tight">${name}</h4>

                    ${isOverdue || isOver
                        ? ``
                        : `
                        <div id="status-action" class="flex items-center bg-gray-800 rounded-lg p-1 gap-1">
                            <button data-status="1" class="status-toggle-btn flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all
                                    ${item.statusName === 1 ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'}"
                                    title="Chờ">
                                <i data-lucide="concierge-bell" class="w-3 h-3"></i>
                            </button>
                            <button data-status="2" class="status-toggle-btn flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all
                                    ${item.statusName === 2 ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'}"
                                    title="Thực hiện">
                                <i data-lucide="activity" class="w-3 h-3"></i>
                            </button>
                            <button data-status="3" class="status-toggle-btn flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all
                                    ${item.statusName === 3 ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'}"
                                    title="Đã xong">
                                <i data-lucide="check" class="w-3 h-3"></i>
                            </button>
                        </div>    
                        `}
                </div>
            
                <div class="text-sm text-gray-300 flex flex-col gap-1">
                    <div class="flex justify-between">
                        <span class="font-medium text-gray-400">${personLabel}</span>
                        <span>${person}</span>
                    </div>
                    ${isTask ? `
                    <div class="flex justify-between">
                        <span class="font-medium text-gray-400">Dự án:</span>
                        <span class="italic text-gray-200">${item.projectName || "N/A"}</span>
                    </div>` : ''}
                </div>

                <div class="flex items-center justify-between pt-3 border-t border-gray-700/50">
                    <div class="text-xs text-gray-400">
                        <span class="block font-medium">Hạn chót:</span>
                        <span class="text-gray-200 text-sm">${dateString}</span>
                    </div>
                    <div class="text-xs font-bold px-2 py-1 rounded bg-gray-900/50 border border-gray-700 ${statusColor}">
                        ${statusText}
                    </div>
                </div>
                <!--
                <div>
                    <textarea readonly disabled class="w-full bg-gray-800 text-white-500 md:text-gray-500 text-sm p-2 rounded-md border border-gray-700 resize-none h-18 custom-scroll">${item.note || "Không có mô tả."}</textarea>
                </div>
                -->
            </div>
        `;

        taskDetailContainer.innerHTML = detailHtml;

        // Tạo icon cho nút back
        if (typeof lucide !== 'undefined') lucide.createIcons();

        // 5. Gắn sự kiện cho nút Quay Lại
        document.getElementById('btnBackToCalendar').addEventListener('click', () => {
            taskDetailContainer.classList.add('hidden');
            daysContainer.classList.remove('hidden');
            calendarHeader.classList.remove('hidden');
            if (weekHeader) weekHeader.classList.remove('hidden');
            if (calendarHeader) calendarHeader.classList.remove('hidden');
        });

        // 6. Gắn sự kiện cho các nút Status
        const statusButtons = taskDetailContainer.querySelectorAll('.status-toggle-btn');
        statusButtons.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const newStatus = parseInt(btn.dataset.status, 10);
                if (newStatus === item.statusName) return; // Không làm gì

                const success = await updateItemStatus(item, newStatus);

                if (success) {
                    // Cập nhật 'item' trong cache
                    item.statusName = newStatus;

                    // Cập nhật UI (nút bấm)
                    statusButtons.forEach(b => {
                        b.classList.remove('bg-indigo-600', 'text-white', 'shadow-sm');
                        b.classList.add('text-gray-400', 'hover:text-white');
                    });
                    btn.classList.add('bg-indigo-600', 'text-white', 'shadow-sm');
                    btn.classList.remove('text-gray-400', 'hover:text-white');

                    // Cập nhật UI (badge trạng thái)
                    const newStatusInfo = getStatusInfo(item, diffDays);
                    const badge = document.getElementById('detail-status-badge');
                    if (badge) {
                        badge.textContent = newStatusInfo.statusText;
                        badge.classList.remove('text-green-400', 'text-red-400', 'text-yellow-400', 'text-blue-400');
                        badge.classList.add(newStatusInfo.statusColor);
                    }

                    // Nếu ấn 'Đã xong', ẩn luôn cụm nút
                    if (newStatus === 3) {
                        const actionDiv = document.getElementById('status-action');
                        if (actionDiv) actionDiv.classList.add('hidden');
                    }

                    // Render lại Summary và Calendar để đồng bộ
                    renderSummary(todayMidnight);
                    renderCalendar(currentDate);
                }
            });
        });
    }

    // ======================================================
    // FUNCTION: HÀM RENDER KHUNG THÔNG BÁO
    // ======================================================
    function renderSummary(todayMidnight, filterDate = null) {
        const alerts = [];
        let noDataMessage = "";

        if (filterDate) {
            // --- CHẾ ĐỘ 1: LỌC THEO NGÀY (khi click) ---
            const key = getKeyLocalFromDateObj(filterDate);
            const itemsForDay = calendarItems[key] || [];

            // Gán 'diffDays' cho các item (để sorting và tô màu)
            itemsForDay.forEach(item => {
                const endLocal = item._parsedDate;
                if (!endLocal) return;
                const endMidnight = new Date(endLocal.getFullYear(), endLocal.getMonth(), endLocal.getDate());
                // Tính diffDays so với 'hôm nay' (todayMidnight)
                const diffDays = Math.ceil((endMidnight - todayMidnight) / (1000 * 60 * 60 * 24));
                alerts.push({ ...item, diffDays });
            });

            // Cập nhật thông báo "không có dữ liệu"
            const dateString = filterDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
            noDataMessage = `
                <div class="w-full flex flex-col items-center justify-center py-8">
                    <i data-lucide="message-circle-warning" class="w-5 h-5"></i>
                    <div class="text-sm text-center text-gray-500 py-2">
                        Không có deadline ngày ${dateString}
                    </div>
                </div>
            `;

        } else {
            // --- CHẾ ĐỘ 2: MẶC ĐỊNH (Hôm nay, Mai, Mốt) ---
            const allItems = Object.values(calendarItems).flat();
            allItems.forEach(item => {
                const endLocal = item._parsedDate;
                if (!endLocal) return;
                const endMidnight = new Date(endLocal.getFullYear(), endLocal.getMonth(), endLocal.getDate());
                const diffDays = Math.ceil((endMidnight - todayMidnight) / (1000 * 60 * 60 * 24));

                // Chỉ lấy item cho hôm nay (0), mai (1), và mốt (2)
                if (diffDays >= 0 && diffDays <= 2) {
                    alerts.push({ ...item, diffDays });
                }
            });

            noDataMessage = `
                <div class="w-full flex flex-col items-center justify-center gap-1 py-8">
                    <i data-lucide="check-circle-2" class="w-5 h-5 text-gray-500"></i>
                    <div class="text-sm text-center text-gray-500 mt-2">
                        Không có việc nào sắp/quá hạn
                    </div>
                </div>
            `;
        }

        // 3. Sắp xếp: (SỬA ĐỔI LOGIC SẮP XẾP)
        alerts.sort((a, b) => {
            const a_is_complete = (a.statusName == 3);
            const b_is_complete = (b.statusName == 3);

            if (a_is_complete && !b_is_complete) return 1;
            if (!a_is_complete && b_is_complete) return -1;

            return a.diffDays - b.diffDays;
        });

        // 4. Render HTML
        if (alerts.length === 0) {
            summaryContainer.innerHTML = noDataMessage;

            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }

            return;
        }

        summaryContainer.innerHTML = alerts.map(item => {
            const { statusColor } = getStatusInfo(item, item.diffDays);
            const text = getDiffText(item.diffDays);

            const icon = (
                item.type === 'task'
                    ? item.statusName == 3
                        ? 'check-square'
                        : 'square'
                    : item.type === 'project'
                        ? item.statusName == 3
                            ? 'folder-check'
                            : 'folder'
                        : 'circle-alert'
            );
            const name = item.type === 'task' ? (item.nameTask || "Task") : (item.projectName || "Project");

            // SỬA: Thêm `fullName` (từ Assignee.FullName hoặc Manager.FullName) vào tooltip
            const person = item.fullName || "";
            const titleAttr = item.type === 'task'
                ? `${name} - ${person} — ${text}`
                : `${name} - Manager: ${person} — ${text}`;

            return `
            <div class="summary-item-clickable flex flex-col items-start justify-start p-1 rounded-md hover:bg-gray-700 transition cursor-pointer"
                 data-item-id="${item.idTask || item.idProject}"
                 data-item-type="${item.type}">
                <div class="flex items-center justify-between text-sm w-full" title="${titleAttr}">
                    <div class="flex items-center overflow-hidden min-w-0">
                        <i data-lucide="${icon}" class="w-4 h-4 mr-2 flex-shrink-0 ${statusColor}"></i>
                        <span class="truncate ${statusColor} text-xs">${name}</span>
                    </div>
                    <span class="flex-shrink-0 text-[10px] text-gray-400 ml-2 ${statusColor}">${text}</span>
                </div>
                <div class="flex items-center justify-between w-full">
                    ${item.type === 'task'
                    ? `<span class="text-[10px] pl-6 text-gray-400 italic truncate max-w-[60%]">${item.projectName}</span>`
                    : ``}
                    <span class="text-[10px] pl-6 text-gray-200 italic truncate ml-auto">${item.fullName}</span>
                </div>
            </div>
        `;
        }).join("");

        // Gọi lại Lucide để render các icon vừa chèn
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    // ======================================================
    // HÀM RENDER CALENDAR
    // ======================================================
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

        // fill blanks
        for (let i = 0; i < startDay; i++) {
            const empty = document.createElement("div");
            daysContainer.appendChild(empty);
        }

        // today midnight local for diff calculation
        const today = new Date();
        const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        taskDetailContainer.innerHTML = '';
        taskDetailContainer.classList.add('hidden');
        daysContainer.classList.remove('hidden');
        if (weekHeader) weekHeader.classList.remove('hidden');
        if (calendarHeader) calendarHeader.classList.remove('hidden');
        // --- MỚI: GỌI HÀM RENDER SUMMARY ---
        // (Luôn render summary dựa trên 'hôm nay', bất kể đang xem tháng nào)
        renderSummary(todayMidnight);
        // --- KẾT THÚC PHẦN MỚI ---

        for (let i = 1; i <= lastDay.getDate(); i++) {
            const day = document.createElement("div");
            day.className = "relative p-2 rounded-full hover:bg-indigo-500 hover:text-white cursor-pointer transition-all";
            day.textContent = i;

            // is today (local)
            const isToday = i === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            if (isToday) day.classList.add("bg-indigo-700", "text-white", "font-bold");

            // key in local
            const keyDate = new Date(year, month, i);
            const key = getKeyLocalFromDateObj(keyDate);

            const allItems = calendarItems[key] || [];

            const tasks = allItems.filter(it => it.type === 'task' && it.statusName != 3);
            const projects = allItems.filter(it => it.type === 'project' && it.statusName != 3);


            if (projects.length > 0) {
                day.classList.add("border-2", "box-border");
                const item = projects[0];
                const endLocal = item._parsedDate || parseDateLocal(item.endDay);
                const endMidnight = new Date(endLocal.getFullYear(), endLocal.getMonth(), endLocal.getDate());
                const diffDays = Math.ceil((endMidnight - todayMidnight) / (1000 * 60 * 60 * 24));

                const { statusColor } = getStatusInfo(item, diffDays);

                if (statusColor === 'text-green-400') day.classList.add("border-green-500");
                else if (statusColor === 'text-red-400') day.classList.add("border-red-500");
                else if (statusColor === 'text-yellow-400') day.classList.add("border-yellow-400");
                else day.classList.add("border-blue-500");
            }

            if (tasks.length > 0) {
                // show up to 3 dots, spaced
                const maxDots = Math.min(tasks.length, 1);
                for (let j = 0; j < maxDots; j++) {
                    const item = tasks[j];
                    const dot = document.createElement("div");
                    const offset = (j - (maxDots - 1) / 2) * 6; // px
                    dot.style.left = `calc(50% + ${offset}px)`;
                    dot.style.transform = "translateX(-50%)";
                    dot.className = "absolute bottom-0.7 w-1.5 h-1.5 rounded-full";
                    const endLocal = item._parsedDate || parseDateLocal(item.endDate || item.endDay);
                    const endMidnight = new Date(endLocal.getFullYear(), endLocal.getMonth(), endLocal.getDate());
                    const diffDays = Math.ceil((endMidnight - todayMidnight) / (1000 * 60 * 60 * 24));

                    // SỬA: Dùng helper để lấy màu
                    const { statusColor } = getStatusInfo(item, diffDays);

                    if (statusColor === 'text-green-400') dot.classList.add("bg-green-500");
                    else if (statusColor === 'text-red-400') dot.classList.add("bg-red-500");
                    else if (statusColor === 'text-yellow-400') dot.classList.add("bg-yellow-400");
                    else dot.classList.add("bg-blue-500");

                    // small tooltip
                    const person = item.fullName || "";
                    dot.title = item.type === "task"
                        ? `${item.nameTask || "Task"} - ${person} — ${item.endDate?.split("T")[0] ?? ""}`
                        : `${item.projectName || "Project"} - ${person} — ${item.endDay?.split("T")[0] ?? ""}`;

                    day.appendChild(dot);
                }

                if (tasks.length > 3) {
                    const more = document.createElement("div");
                    more.textContent = `+${tasks.length - 1}`;
                    more.className = "absolute text-[10px] bottom-5 right-3 text-green-400";
                    day.appendChild(more);
                }
            }

            // ======================================================
            // SỬA: THÊM SỰ KIỆN CLICK CHO TỪNG NGÀY
            // ======================================================
            day.addEventListener("click", (e) => {
                e.stopPropagation();

                // Khi click ngày, reset detail về ẩn để hiện list
                taskDetailContainer.innerHTML = '';
                taskDetailContainer.classList.add('hidden');
                daysContainer.classList.remove('hidden'); // Đảm bảo grid hiện
                if (weekHeader) weekHeader.classList.remove('hidden'); // Đảm bảo header hiện
                if (calendarHeader) calendarHeader.classList.remove('hidden');

                // 1. Cập nhật Summary
                // 'todayMidnight' và 'keyDate' đều đã có sẵn trong scope này
                renderSummary(todayMidnight, keyDate);

                // 2. Cập nhật Highlight
                // Xóa highlight cũ
                const currentlySelected = daysContainer.querySelector('.day-selected');
                if (currentlySelected) {
                    currentlySelected.classList.remove('day-selected');
                    // Chỉ xóa màu nền nếu nó KHÔNG PHẢI là 'hôm nay'
                    if (!currentlySelected.classList.contains('bg-indigo-700')) {
                        currentlySelected.classList.remove('bg-indigo-500', 'text-white');
                    }
                }

                // Thêm highlight mới
                day.classList.add('day-selected');
                // Nếu nó không phải 'hôm nay', thì thêm màu nền highlight
                if (!isToday) {
                    day.classList.add('bg-indigo-500', 'text-white');
                }
            });

            daysContainer.appendChild(day);
        }
    }

    // toggle popup: when opening, reset to current month
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const wasHidden = popup.classList.contains("hidden");
        popup.classList.toggle("hidden");
        if (wasHidden) {
            currentDate = new Date();
            renderCalendar(currentDate);
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

    // click outside => hide and reset to current month
    document.addEventListener("click", (e) => {
        if (!popup.contains(e.target) && !btn.contains(e.target)) {
            popup.classList.add("hidden");
            currentDate = new Date();
            renderCalendar(currentDate);
        }
    });

    // ======================================================
    // MỚI: SỰ KIỆN CHO CÁC THẺ SELECT
    // ======================================================
    function handleSelectChange() {
        const newYear = parseInt(selectYear.value, 10);
        const newMonth = parseInt(selectMonth.value, 10);

        // Set ngày về 1 để tránh lỗi (ví dụ: nhảy từ 31/1 sang tháng 2)
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
        if (item) {
            showTaskDetail(item);
        }
    });

    // MỚI: Điền các tháng (chỉ chạy 1 lần duy nhất)
    populateMonthSelector();
    // initial render (hidden)
    renderCalendar(currentDate);
});