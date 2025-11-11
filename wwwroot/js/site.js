function toggleTheme() {
    document.documentElement.classList.toggle('dark');
}
document.addEventListener("DOMContentLoaded", async () => {
    const [meRes] = await Promise.all([
        fetch("/api/user/me")
    ]);
    const [me] = await Promise.all([
        meRes.json(),
    ]);
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
    const title = document.getElementById("calendarTitle");
    const prev = document.getElementById("prevMonth");
    const next = document.getElementById("nextMonth");

    // helper
    const pad = n => n.toString().padStart(2, "0");

    // parse date string to local date at midnight (avoid timezone shift)
    // parse date string to local date at midnight (avoid timezone shift)
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
    const [taskDeadline, /*projectDeadline*/] = await Promise.all([
        safeFetchJson("/api/tasks/deadline", []),
        //safeFetchJson("/api/projects/deadline", [])
    ]);

    console.log("Task/deadline: ", taskDeadline);

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

    //(projectDeadline || []).forEach(p => {
    //    const d = parseDateLocal(p.endDay);
    //    if (!d) return;
    //    const key = getKeyLocalFromDateObj(d);
    //    pushItem(key, { ...p, type: "project", _parsedDate: d });
    //});

    // current shown month (local)
    let currentDate = new Date();

    function renderCalendar(date) {
        const year = date.getFullYear();
        const month = date.getMonth();
        title.textContent = `Tháng ${month + 1} / ${year}`;

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDay = (firstDay.getDay() + 6) % 7; // make Monday first (T2)

        daysContainer.innerHTML = "";

        // fill blanks
        for (let i = 0; i < startDay; i++) {
            const empty = document.createElement("div");
            daysContainer.appendChild(empty);
        }

        // today midnight local for diff calculation
        const today = new Date();
        const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

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

            const items = calendarItems[key] || [];
            if (items.length > 0) {
                // show up to 3 dots, spaced
                const maxDots = Math.min(items.length, 3);
                for (let j = 0; j < maxDots; j++) {
                    const item = items[j];
                    const dot = document.createElement("div");
                    // small displacement so dots don't fully overlap
                    const offset = (j - (maxDots - 1) / 2) * 6; // px
                    dot.style.left = `calc(50% + ${offset}px)`;
                    dot.style.transform = "translateX(-50%)";
                    dot.className = "absolute bottom-0.7 w-1.5 h-1.5 rounded-full";

                    // compute diffDays using local midnight dates
                    const endLocal = item._parsedDate || parseDateLocal(item.endDate || item.endDay);
                    const endMidnight = new Date(endLocal.getFullYear(), endLocal.getMonth(), endLocal.getDate());
                    const diffDays = Math.ceil((endMidnight - todayMidnight) / (1000 * 60 * 60 * 24));

                    if (item.statusName == 3) dot.classList.add("bg-green-500");
                    else if (diffDays < 0) dot.classList.add("bg-red-500");
                    else if (diffDays <= 3) dot.classList.add("bg-yellow-400");
                    else dot.classList.add("bg-blue-500");

                    // small tooltip
                    dot.title = item.type === "task"
                        ? `${item.nameTask || item.Name || "Task"} — ${item.endDate?.split("T")[0] ?? ""}`
                        : `${item.projectName || "Project"} — ${item.endDay?.split("T")[0] ?? ""}`;

                    day.appendChild(dot);
                }

                if (items.length > 3) {
                    const more = document.createElement("div");
                    more.textContent = `+${items.length - 3}`;
                    more.className = "absolute text-[10px] bottom-3 right-1 text-gray-300";
                    day.appendChild(more);
                }
            }

            // click on day -> show list of items for that day (optional)
            day.addEventListener("click", (e) => {
                e.stopPropagation();
                const dayItems = calendarItems[key] || [];
                if (dayItems.length === 0) return;
                // simple detail popup (you can replace with your UI)
                const list = dayItems.map(it => {
                    if (it.type === "task") return `Task: ${it.nameTask} — ${it.endDate?.split("T")[0] ?? ""} — ${it.fullName ?? ""}`;
                    return `Project: ${it.projectName} — ${it.endDay?.split("T")[0] ?? ""}`;
                }).join("\n");
                alert(list);
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

    // initial render (hidden)
    renderCalendar(currentDate);
});
