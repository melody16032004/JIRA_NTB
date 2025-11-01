//
document.addEventListener("DOMContentLoaded", () => {
    lucide.createIcons();

    const dropdowns = [
        { button: "userMenuButton", menu: "userDropdown" },
        { button: "notifyButton", menu: "notifyDropdown" }
    ];

    dropdowns.forEach(({ button, menu }) => {
        const btn = document.getElementById(button);
        const menuEl = document.getElementById(menu);

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
            dropdowns.forEach(({ menu }) =>
                document.getElementById(menu).classList.add("opacity-0", "scale-95", "pointer-events-none")
            );
            if (hidden) open();
        });

        document.addEventListener("click", (e) => {
            if (!menuEl.contains(e.target) && !btn.contains(e.target)) close();
        });
    });

    // === Notification Shake Effect ===
    const notifyButton = document.getElementById("notifyButton");
    const notifyBadge = document.getElementById("notifyBadge");
    const clearBtn = document.getElementById("clearNotify");
    const notifyList = document.querySelector("#notifyDropdown ul");

    // === Hàm cập nhật số lượng thông báo chưa đọc ===
    function updateNotifyCount() {
        const unreadItems = notifyList.querySelectorAll(".unread");
        const count = unreadItems.length;
        if (count > 0) {
            notifyBadge.style.display = "flex";
            notifyBadge.textContent = count;
        } else {
            notifyBadge.style.display = "none";
        }
    }

    // === Đánh dấu 1 thông báo là đã đọc khi click ===
    notifyList.addEventListener("click", (e) => {
        const li = e.target.closest("li");
        if (!li) return;

        if (li.classList.contains("unread")) {
            li.classList.remove("unread");
            const redDot = li.querySelector("span.bg-red-500");
            if (redDot) redDot.remove();
            updateNotifyCount();
        }
    });

    // === Đánh dấu tất cả là đã đọc ===
    clearBtn.addEventListener("click", () => {
        const unreadItems = notifyList.querySelectorAll(".unread");
        unreadItems.forEach(li => {
            li.classList.remove("unread");
            const dot = li.querySelector("span.bg-red-500");
            if (dot) dot.remove();
        });
        updateNotifyCount();
    });

    // === Shake icon khi có thông báo ===
    function triggerShake() {
        if (parseInt(notifyBadge.textContent) > 0) {
            notifyButton.classList.add("shake");
            setTimeout(() => notifyButton.classList.remove("shake"), 700);
        }
    }

    // 🔁 Lặp lại shake mỗi 2 giây nếu có thông báo
    setInterval(() => {
        if (!notifyBadge.classList.contains("hidden") && notifyBadge.style.display !== "none") {
            triggerShake();
        }
    }, 2000);

    // Giả lập có thông báo mới
    setTimeout(() => {
        notifyBadge.style.display = "flex";
        notifyBadge.textContent = "2";
    }, 1000);

    updateNotifyCount();
});