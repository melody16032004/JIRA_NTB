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

    const [taskDeadlineRes, projectDeadlineRes] = await Promise.all([
        fetch("/api/tasks/deadline"),
        fetch("/api/projects/deadline"),
    ]);
    const [taskDeadline, projectDeadline] = await Promise.all([
        taskDeadlineRes.json(),
        projectDeadlineRes.json(),
    ]);
    
    console.log("Task deadline: ", taskDeadline);
    console.log("Project deadline: ", projectDeadline);

    let currentDate = new Date();
    // Chuẩn hóa dữ liệu thành map: { 'YYYY-MM-DD': [items] }
    const calendarItems = {};

    const addToCalendarItems = (arr, dateField, type) => {
        arr.forEach(item => {
            const d = new Date(item[dateField]);
            const key = d.toISOString().split("T")[0]; // yyyy-mm-dd UTC
            if (!calendarItems[key]) calendarItems[key] = [];
            calendarItems[key].push({ ...item, type });
        });
    };

    addToCalendarItems(taskDeadline, "endDate", "task");
    addToCalendarItems(projectDeadline, "endDay", "project");

    const renderCalendar = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        title.textContent = `Tháng ${month + 1} / ${year}`;

        // Ngày đầu và cuối tháng
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDay = (firstDay.getDay() + 6) % 7; // chuyển CN=0 → cuối tuần

        daysContainer.innerHTML = "";

        // Thêm ngày trống đầu tháng
        for (let i = 0; i < startDay; i++) {
            daysContainer.appendChild(document.createElement("div"));
        }

        const now = new Date();

        // Thêm ngày trong tháng
        for (let i = 1; i <= lastDay.getDate(); i++) {
            const day = document.createElement("div");
            day.className = "relative p-2 rounded-full hover:bg-indigo-500 hover:text-white cursor-pointer transition-all";
            day.textContent = i;

            const isToday =
                i === new Date().getDate() &&
                month === new Date().getMonth() &&
                year === new Date().getFullYear();

            if (isToday) day.classList.add("bg-indigo-600", "text-white", "font-bold");

            // Lấy key yyyy-mm-dd
            const key = new Date(Date.UTC(year, month, i)).toISOString().split("T")[0];
            const items = calendarItems[key];
            if (items && items.length > 0) {
                // Tạo dot nhỏ cho mỗi deadline
                items.forEach(item => {
                    const dot = document.createElement("div");
                    dot.className = "absolute left-1/2 -translate-x-1/2 bottom-0.5 w-1 h-1 rounded-full";

                    const endDate = new Date(item.type === "task" ? item.endDate : item.endDay);
                    const diffDays = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

                    if (diffDays <= 0) dot.classList.add("bg-red-500");
                    else if (diffDays <= 3) dot.classList.add("bg-yellow-400");
                    else dot.classList.add("bg-green-500");

                    day.appendChild(dot);
                });
            }

            daysContainer.appendChild(day);
        }
    };

    btn.addEventListener("click", () => {
        popup.classList.toggle("hidden");

        if (!popup.classList.contains("hidden")) {
            // Khi popup vừa hiện, reset về tháng hiện tại
            currentDate = new Date();
            renderCalendar(currentDate);
        }
    });

    prev.addEventListener("click", () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar(currentDate);
    });

    next.addEventListener("click", () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar(currentDate);
    });

    // Ẩn khi click ra ngoài
    document.addEventListener("click", (e) => {
        if (!popup.contains(e.target) && !btn.contains(e.target)) {
            popup.classList.add("hidden");
            currentDate = new Date(); // reset về tháng hiện tại
            renderCalendar(currentDate);
        }
    });

    renderCalendar(currentDate);
});
