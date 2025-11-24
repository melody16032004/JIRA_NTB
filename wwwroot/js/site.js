function toggleTheme() {
    document.documentElement.classList.toggle('dark');
}
let me = null; // Khai báo 'me' ở ngoài
document.addEventListener("DOMContentLoaded", async () => {
    if (!me) {
        try {
            const meRes = await fetch("/api/user/me");

            if (meRes.ok) {
                me = await meRes.json();
            }

        } catch (e) {
            console.error("Fetch failed:", e);
        }
    }

    if (!me || me == null) {
        window.location.href = "/Error/403";
        return;
    }

    //console.log(me);

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

            // SỬA: Kiểm tra xem nó đang mở hay không
            const isOpen = !menuEl.classList.contains("opacity-0");

            // 1. Đóng TẤT CẢ các menu trước
            dropdowns.forEach(({ menu: otherMenu }) => {
                const m = document.getElementById(otherMenu);
                if (m) {
                    m.classList.add("opacity-0", "scale-95", "pointer-events-none");
                    m.classList.remove("opacity-100", "scale-100");
                }
            });

            // 2. Nếu nó CHƯA MỞ (tức là ta muốn mở nó)
            // (Nếu nó đã mở, thì bước 1 đã đóng nó và ta không làm gì thêm)
            if (!isOpen) {
                open();
            }
        });

        document.addEventListener("click", (e) => {
            if (!menuEl.contains(e.target) && !btn.contains(e.target)) close();
        });
    });

    ///* ===== NOTIFICATION HANDLING ===== */
    //const notifyButton = document.getElementById("notifyButton");
    //const notifyBadge = document.getElementById("notifyBadge");
    //const clearBtn = document.getElementById("clearNotify");
    //const notifyList = document.querySelector("#notifyDropdown ul");

    //if (notifyButton && notifyBadge && notifyList && clearBtn) {
    //    // Cập nhật số lượng chưa đọc
    //    function updateNotifyCount() {
    //        const unread = notifyList.querySelectorAll(".unread").length;
    //        notifyBadge.style.display = unread > 0 ? "flex" : "none";
    //        notifyBadge.textContent = unread > 0 ? unread : "";
    //    }

    //    // Đánh dấu 1 thông báo là đã đọc
    //    notifyList.addEventListener("click", (e) => {
    //        const li = e.target.closest("li.unread");
    //        if (!li) return;
    //        li.classList.remove("unread");
    //        const redDot = li.querySelector("span.bg-red-500");
    //        if (redDot) redDot.remove();
    //        updateNotifyCount();
    //    });

    //    // Đánh dấu tất cả là đã đọc
    //    clearBtn.addEventListener("click", () => {
    //        notifyList.querySelectorAll(".unread").forEach((li) => {
    //            li.classList.remove("unread");
    //            const dot = li.querySelector("span.bg-red-500");
    //            if (dot) dot.remove();
    //        });
    //        updateNotifyCount();
    //    });

    //    // Hiệu ứng shake khi có thông báo
    //    function triggerShake() {
    //        if (parseInt(notifyBadge.textContent) > 0) {
    //            notifyButton.classList.add("shake");
    //            setTimeout(() => notifyButton.classList.remove("shake"), 700);
    //        }
    //    }

    //    // Lặp lại shake nếu có thông báo chưa đọc
    //    setInterval(() => {
    //        if (notifyBadge.style.display !== "none") triggerShake();
    //    }, 2000);

    //    // Giả lập có thông báo mới sau 1s
    //    setTimeout(() => {
    //        notifyBadge.style.display = "flex";
    //        notifyBadge.textContent = "2";
    //    }, 1000);

    //    updateNotifyCount();
    //}
});
