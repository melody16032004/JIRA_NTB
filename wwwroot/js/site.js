function toggleTheme() {
    document.documentElement.classList.toggle('dark');
}
let me = null;

document.addEventListener("DOMContentLoaded", async () => {
    // --- 1. FETCH USER INFO (Giữ nguyên) ---
    //if (!me) {
    //    try {
    //        const meRes = await fetch("/api/user/me");
    //        if (meRes.ok) {
    //            me = await meRes.json();
    //        }
    //    } catch (e) {
    //        console.error("Fetch failed:", e);
    //    }
    //}

    //if (!me || me == null) {
    //    // window.location.href = "/Error/403"; // Tùy chọn redirect
    //    return;
    //}

    //const meCur = document.getElementById("me");
    //if (meCur) meCur.innerHTML += `${me.fullName}`;

    lucide.createIcons();

    /* ===== SIDEBAR TOGGLE (Giữ nguyên) ===== */
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

    /* ===== DROPDOWN HANDLER (CHỈ DÀNH CHO USER MENU) ===== */
    // SỬA: Bỏ notifyButton ra khỏi mảng này
    const dropdowns = [
        { button: "userMenuButton", menu: "userDropdown" }
        // { button: "notifyButton", menu: "notifyDropdown" } <-- XÓA DÒNG NÀY
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
            const isOpen = !menuEl.classList.contains("opacity-0");

            // Đóng các menu khác (nếu có nhiều menu user)
            dropdowns.forEach(({ menu: otherMenu }) => {
                const m = document.getElementById(otherMenu);
                if (m && m !== menuEl) { // Chỉ đóng cái khác
                    m.classList.add("opacity-0", "scale-95", "pointer-events-none");
                    m.classList.remove("opacity-100", "scale-100");
                }
            });

            if (!isOpen) {
                open();
            } else {
                close();
            }
        });

        document.addEventListener("click", (e) => {
            if (!menuEl.contains(e.target) && !btn.contains(e.target)) close();
        });
    });
});