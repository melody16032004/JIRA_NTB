function toggleTheme() {
    document.documentElement.classList.toggle('dark');
}
let me = null; // Khai báo 'me' ở ngoài
document.addEventListener("DOMContentLoaded", async () => {
    if (!me) {
        try {
            const meRes = await fetch("/api/user/me");

            // 1. Chỉ thử .json() nếu request thành công (status 200-299)
            if (meRes.ok) {
                me = await meRes.json();
            }
            // 2. Nếu meRes không .ok (ví dụ 404, 500), 'me' sẽ vẫn là 'null'

        } catch (e) {
            // 3. Lỗi này xảy ra nếu có lỗi mạng (Failed to fetch)
            // 'me' sẽ vẫn là 'null'
            console.error("Fetch failed:", e);
        }
    }

    // Bây giờ, 'me' sẽ là 'null' nếu:
    // 1. Fetch lỗi mạng (trong catch)
    // 2. Server trả về 401, 404, 500 (vì meRes.ok là false)
    // 3. Server trả về 200 OK với body là 'null'

    if (!me || me == null) {
        window.location.href = "/Error/403";
    }

    console.log(me);

    const meCur = document.getElementById("me");
    meCur.innerHTML += `${me.fullName}`;

    // ⚙️ Sau khi thêm icon mới, phải render lại Lucide icons
    lucide.createIcons();

    // const cur = User


    /* ===== SIDEBAR TOGGLE ===== */
    const sidebar = document.getElementById("sidebar");
    const sidebarToggle = document.getElementById("sidebarToggle");
    const sidebarOverlay = document.getElementById("sidebarOverlay");

    if (sidebarToggle && sidebar && sidebarOverlay) {
        sidebarToggle.addEventListener("click", (e) => {
            e.stopPropagation();
            sidebar.classList.remove("-translate-x-full");
            sidebarOverlay.classList.remove("hidden");
        });

        sidebarOverlay.addEventListener("click", (e) => {
            e.stopPropagation();
            sidebar.classList.add("-translate-x-full");
            sidebarOverlay.classList.add("hidden");
        });
    }

    /* ===== DROPDOWN HANDLER (user + notify) ===== */
    const dropdowns = [
        { button: "userMenuButton", menu: "userDropdown" },
        { button: "notifyButton", menu: "notifyDropdown" }
    ];

    dropdowns.forEach(({ button, menu }) => {
        const btn = document.getElementById(button);
        const menuEl = document.getElementById(menu);
        if (!btn || !menuEl) return;

        const open = () => {
            menuEl.classList.remove("opacity-0", "scale-95", "pointer-events-none");
            menuEl.classList.add("opacity-100", "scale-100");
        };
        const close = () => {
            menuEl.classList.add("opacity-0", "scale-95", "pointer-events-none");
            menuEl.classList.remove("opacity-100", "scale-100");
        };

        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const hidden = menuEl.classList.contains("opacity-0");
            // Ẩn tất cả dropdown khác trước khi mở
            dropdowns.forEach(({ menu }) => {
                const m = document.getElementById(menu);
                if (m) m.classList.add("opacity-0", "scale-95", "pointer-events-none");
            });
            if (hidden) open();
        });

        document.addEventListener("click", (e) => {
            if (!menuEl.contains(e.target) && !btn.contains(e.target)) close();
        });
    });

    /* ===== NOTIFICATION HANDLING ===== */
    const notifyButton = document.getElementById("notifyButton");
    const notifyBadge = document.getElementById("notifyBadge");
    const clearBtn = document.getElementById("clearNotify");
    const notifyList = document.querySelector("#notifyDropdown ul");

    if (notifyButton && notifyBadge && notifyList && clearBtn) {
        // Cập nhật số lượng chưa đọc
        function updateNotifyCount() {
            const unread = notifyList.querySelectorAll(".unread").length;
            notifyBadge.style.display = unread > 0 ? "flex" : "none";
            notifyBadge.textContent = unread > 0 ? unread : "";
        }

        // Đánh dấu 1 thông báo là đã đọc
        notifyList.addEventListener("click", (e) => {
            const li = e.target.closest("li.unread");
            if (!li) return;
            li.classList.remove("unread");
            const redDot = li.querySelector("span.bg-red-500");
            if (redDot) redDot.remove();
            updateNotifyCount();
        });

        // Đánh dấu tất cả là đã đọc
        clearBtn.addEventListener("click", () => {
            notifyList.querySelectorAll(".unread").forEach((li) => {
                li.classList.remove("unread");
                const dot = li.querySelector("span.bg-red-500");
                if (dot) dot.remove();
            });
            updateNotifyCount();
        });

        // Hiệu ứng shake khi có thông báo
        function triggerShake() {
            if (parseInt(notifyBadge.textContent) > 0) {
                notifyButton.classList.add("shake");
                setTimeout(() => notifyButton.classList.remove("shake"), 700);
            }
        }

        // Lặp lại shake nếu có thông báo chưa đọc
        setInterval(() => {
            if (notifyBadge.style.display !== "none") triggerShake();
        }, 2000);

        // Giả lập có thông báo mới sau 1s
        setTimeout(() => {
            notifyBadge.style.display = "flex";
            notifyBadge.textContent = "2";
        }, 1000);

        updateNotifyCount();
    }

    // ==============================
    // ========== Calendar ==========
    // ==============================
    const btn = document.getElementById("calendarButton");
    const popup = document.getElementById("calendarPopup");
    const daysContainer = document.getElementById("calendarDays");
    //const title = document.getElementById("calendarTitle");
    const selectMonth = document.getElementById("selectMonth"); // <<< THÊM VÀO
    const selectYear = document.getElementById("selectYear"); // <<< THÊM VÀO
    const prev = document.getElementById("prevMonth");
    const next = document.getElementById("nextMonth");
    const summaryContainer = document.getElementById("calendarSummary");

    // helper
    const pad = n => n.toString().padStart(2, "0");

    function parseDateLocal(dateString) {
        if (!dateString) return null;

        // Regex để kiểm tra chuỗi có phải là YYYY-MM-DD đơn giản không
        const simpleDateRegex = /^\d{4}-\d{2}-\d{2}$/;

        if (simpleDateRegex.test(dateString)) {
            // 1. Xử lý trường hợp "2025-11-10" (không có giờ)
            // Giữ logic cũ của bạn: parse thành nửa đêm local
            const [y, m, d] = dateString.split("-").map(s => parseInt(s, 10));
            if (!y || !m || !d) return null;
            return new Date(y, m - 1, d); // local midnight
        }

        // 2. Xử lý trường hợp có giờ/timezone (ví dụ: "2025-11-09T23:00:00Z")
        // Để JavaScript tự động chuyển đổi múi giờ
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return null; // Invalid date

        // Lấy nửa đêm (00:00:00) của ngày local *sau khi đã chuyển đổi*
        // Ví dụ: "2025-11-09T23:00:00Z" -> 06:00 ngày 10/11 (local)
        // -> Hàm sẽ trả về 00:00 ngày 10/11 (local)
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

    // current shown month (local)
    let currentDate = new Date();

    // ======================================================
    // MỚI: CÁC HÀM ĐIỀN THÁNG/NĂM
    // ======================================================

    // Hàm này chỉ chạy 1 lần
    function populateMonthSelector() {
        const months = [
            "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
            "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"
        ];
        selectMonth.innerHTML = months.map((month, index) => {
            return `<option value="${index}">${month}</option>`;
        }).join("");
    }

    // Hàm này sẽ chạy mỗi khi render,
    // để đảm bảo năm hiện tại luôn ở khoảng giữa
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
        //    - Ưu tiên 1: Đẩy statusName = 3 (Hoàn thành) xuống dưới cùng.
        //    - Ưu tiên 2: Trong mỗi nhóm (chưa hoàn thành / đã hoàn thành), sắp xếp theo diffDays.
        alerts.sort((a, b) => {
            const a_is_complete = (a.statusName == 3);
            const b_is_complete = (b.statusName == 3);

            if (a_is_complete && !b_is_complete) return 1;
            if (!a_is_complete && b_is_complete) return -1;

            // Nếu cả hai cùng trạng thái (cùng hoàn thành hoặc cùng chưa),
            // thì sắp xếp theo ngày (gần nhất lên trước)
            return a.diffDays - b.diffDays;
        });

        // 4. Render HTML
        if (alerts.length === 0) {
            //summaryContainer.innerHTML = `<div class="text-base text-center text-gray-500 py-8">Không có việc nào sắp/quá hạn.</div>`;
            summaryContainer.innerHTML = noDataMessage;

            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }

            return;
        }

        summaryContainer.innerHTML = alerts.map(item => {
            const text = getDiffText(item.diffDays);
            let colorClass = 'text-blue-400'; // Mặc định (ngày mốt)

            if (item.statusName == 3) {
                colorClass = 'text-green-400'; // Đã hoàn thành
            }
            else if (item.diffDays < 0) { // Thêm check quá hạn
                colorClass = 'text-red-400';
            }
            else if (item.diffDays <= 1) { // Hôm nay hoặc ngày mai
                colorClass = 'text-yellow-400';
            }

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
            <div class="flex flex-col items-start justify-start p-1 rounded-md hover:bg-gray-700 transition">
                <div class="flex items-center justify-between text-sm cursor-pointer w-full" title="${titleAttr}">
                    <div class="flex items-center overflow-hidden min-w-0">
                        <i data-lucide="${icon}" class="w-4 h-4 mr-2 flex-shrink-0 ${colorClass}"></i>
                        <span class="truncate ${colorClass} text-xs">${name}</span>
                    </div>
                    <span class="flex-shrink-0 text-[10px] text-gray-400 ml-2 ${colorClass}">${text}</span>
                </div>
                <div class="flex items-center justify-between w-full">
                    ${ item.type === 'task'
                        ? `<span class="text-[10px] pl-6 text-gray-400 italic">${item.projectName}</span>`
                        : ``}
                    <span class="text-[10px] pl-6 text-gray-200 italic">${item.fullName}</span>
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

                // Tô màu cho border (giống logic tô màu của task)
                // (API Project của bạn không có statusName, nên chỉ tô theo ngày)
                if (item.statusName == 3) day.classList.add("border-green-500")
                else if (diffDays < 0) day.classList.add("border-red-500");
                else if (diffDays <= 3) day.classList.add("border-yellow-400");
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

                    //if (item.statusName == 3) dot.classList.add("bg-green-500");
                    //else
                    if (diffDays < 0) dot.classList.add("bg-red-500");
                    else if (diffDays <= 3) dot.classList.add("bg-yellow-400");
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

            // click on day -> show list of items for that day (optional)
            //day.addEventListener("click", (e) => {
            //    e.stopPropagation();
            //    const dayItems = calendarItems[key] || [];
            //    if (dayItems.length === 0) return;
            //    // simple detail popup (you can replace with your UI)
            //    const list = dayItems.map(it => {
            //        if (it.type === "task") return `Task: ${it.nameTask} — ${it.endDate?.split("T")[0] ?? ""} — ${it.fullName ?? ""}`;
            //        return `Project: ${it.projectName} — ${it.endDay?.split("T")[0] ?? ""} - ${it.fullName ?? ""}`;
            //    }).join("\n");
            //    alert(list);
            //});
            // ======================================================
            // SỬA: THÊM SỰ KIỆN CLICK CHO TỪNG NGÀY
            // ======================================================
            day.addEventListener("click", (e) => {
                e.stopPropagation();

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

    // MỚI: Điền các tháng (chỉ chạy 1 lần duy nhất)
    populateMonthSelector();
    // initial render (hidden)
    renderCalendar(currentDate);
});
