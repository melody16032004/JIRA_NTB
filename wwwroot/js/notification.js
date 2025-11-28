// ===============================
// -----| /js/notification.js |-------
// ===============================

document.addEventListener("DOMContentLoaded", () => {

    // --- 1. DOM ELEMENTS ---
    const notifyButton = document.getElementById("notifyButton");
    const notifyDropdown = document.getElementById("notifyDropdown");

    // Tab & Lists
    const tabIdle = document.getElementById("tabIdle");
    const tabAll = document.getElementById("tabAll");
    const idleList = document.getElementById("idleList");
    const notifyList = document.getElementById("notifyList");

    // Toolbar Buttons
    const clearBtn = document.getElementById("clearNotify");
    const refreshIdleBtn = document.getElementById("refreshIdleBtn");

    // State
    let isIdleLoaded = false;
    let isDropdownOpen = false;

    // --- 2. HELPER FETCH ---
    async function safeFetchJson(url, fallback = []) {
        try {
            console.log(`Fetching: ${url}`);
            const res = await fetch(url, { credentials: 'include' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (err) {
            console.error("❌ Fetch failed:", url, err);
            return fallback;
        }
    }

    // --- 3. HÀM TẢI IDLE USERS ---
    async function loadIdleUsers() {
        if (!idleList) return;
        console.log("🔄 Bắt đầu tải danh sách Idle...");

        // Hiển thị Loader
        idleList.innerHTML = `
            <div class="p-6 text-center text-gray-500 text-xs flex flex-col items-center gap-2">
                <i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i>
                <span>Đang tìm nhân sự rảnh...</span>
            </div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();

        try {
            // Gọi API
            const data = await safeFetchJson("/api/notification/users/idle", []);
            console.log("✅ Dữ liệu nhận được:", data); // Xem dữ liệu trả về có gì không

            // Xóa loader
            idleList.innerHTML = "";

            // Xử lý dữ liệu rỗng
            if (!data || data.length === 0) {
                idleList.innerHTML = `
                    <div class="p-6 text-center text-gray-500">
                        <div class="flex flex-col items-center gap-2">
                            <i data-lucide="briefcase" class="w-8 h-8 text-gray-600"></i>
                            <p class="text-sm">Không có nhân sự nào đang nhàn rỗi.</p>
                        </div>
                    </div>`;
                if (typeof lucide !== 'undefined') lucide.createIcons();
                return;
            }

            // Render danh sách
            const ul = document.createElement("ul");
            ul.className = "divide-y divide-gray-700";

            data.forEach(u => {
                // Logic màu sắc
                let leftDays = ``;
                if (u.dayLeft < 0 || u.dayLeft == null) leftDays = `<span class="text-green-400 font-bold">[Đang rảnh]</span>`;
                else if (u.dayLeft === 0) leftDays = `<span class="text-yellow-400 font-bold">(Rảnh vào ngày mai)</span>`;
                else leftDays = `<span class="text-red-400 font-bold">(Bận thêm ${u.dayLeft} ngày)</span>`;

                const html = `
                    <li class="p-3 hover:bg-gray-700/50 transition flex items-start space-x-3 cursor-pointer group">
                        <div class="relative">
                            <div class="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center group-hover:bg-gray-600 transition">
                                 <i data-lucide="coffee" class="w-4 h-4 text-orange-400"></i>
                            </div>
                            <span class="absolute -bottom-0 -right-0 w-2.5 h-2.5 bg-green-500 border-2 border-gray-800 rounded-full"></span>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex justify-between items-start">
                                <p class="text-sm font-medium text-gray-200 truncate">${u.fullName}</p>
                                ${u.isNew ? '<span class="bg-blue-900 text-blue-300 text-[10px] px-1.5 py-0.5 rounded">Mới</span>' : ''}
                            </div>
                            <p class="text-xs text-gray-400 truncate">${u.email}</p>
                            <div class="mt-1 flex items-center gap-1 text-[10px] text-gray-500">
                                <i data-lucide="clock" class="w-3 h-3"></i>
                                <span>Rảnh từ: <span class="text-gray-300">${u.freeSince}</span> ${leftDays}</span>
                            </div>
                        </div>
                    </li>
                `;
                ul.insertAdjacentHTML('beforeend', html);
            });

            idleList.appendChild(ul);
            if (typeof lucide !== 'undefined') lucide.createIcons();

            isIdleLoaded = true;

        } catch (err) {
            console.error("❌ Lỗi render idle list:", err);
            idleList.innerHTML = `<div class="p-4 text-center text-red-400 text-xs">Lỗi hiển thị dữ liệu.</div>`;
        }
    }

    // --- 4. HÀM CHUYỂN TAB (CƯỠNG CHẾ HIỂN THỊ BẰNG STYLE) ---
    const switchToIdleTab = () => {
        console.log("👉 Đang chuyển sang tab Idle...");
        if (!tabIdle || !idleList) return;

        // 1. Style Tab
        tabIdle.classList.add("text-indigo-400", "border-indigo-500");
        tabIdle.classList.remove("text-gray-400", "border-transparent");

        if (tabAll) {
            tabAll.classList.add("text-gray-400", "border-transparent");
            tabAll.classList.remove("text-indigo-400", "border-indigo-500");
        }

        // 2. Ẩn nút Clear, Hiện nút Refresh
        if (clearBtn) clearBtn.style.display = 'none';
        if (refreshIdleBtn) refreshIdleBtn.style.display = 'flex';

        // 3. Ẩn/Hiện List bằng style.display (Chắc chắn nhất)
        if (notifyList) notifyList.style.display = 'none'; // Ẩn list thông báo

        idleList.style.display = 'block';  // Hiện list idle
        idleList.style.opacity = '1';      // Đảm bảo không bị trong suốt
        idleList.style.transform = 'none'; // Bỏ dịch chuyển
        idleList.classList.remove('hidden', 'opacity-0', 'translate-x-4'); // Bỏ class Tailwind ẩn

        // 4. Gọi API
        if (!isIdleLoaded) {
            loadIdleUsers();
        }
    };

    // --- 5. SỰ KIỆN CLICK NÚT CHUÔNG ---
    if (notifyButton && notifyDropdown) {
        notifyButton.addEventListener("click", (e) => {
            e.stopPropagation();
            console.log("🔔 Đã bấm nút chuông");

            if (!isDropdownOpen) {
                // === MỞ ===
                console.log("🔓 Đang mở dropdown...");

                // Xóa các class ẩn của Tailwind
                notifyDropdown.classList.remove("opacity-0", "scale-95", "pointer-events-none");

                // Thêm các class hiện
                notifyDropdown.classList.add("opacity-100", "scale-100", "pointer-events-auto");

                // Cưỡng chế style (phòng hờ Tailwind chưa load kịp)
                notifyDropdown.style.opacity = '1';
                notifyDropdown.style.pointerEvents = 'auto';
                notifyDropdown.style.transform = 'scale(1)';

                isDropdownOpen = true;

                // Chuyển tab ngay lập tức
                if (tabIdle) {
                    switchToIdleTab();
                } else {
                    // Trường hợp Employee (không có tab Idle) -> hiện notify list
                    if (notifyList) notifyList.style.display = 'block';
                    if (clearBtn) clearBtn.style.display = 'flex';
                }

            } else {
                // === ĐÓNG ===
                console.log("🔒 Đang đóng dropdown...");
                notifyDropdown.classList.add("opacity-0", "scale-95", "pointer-events-none");
                notifyDropdown.classList.remove("opacity-100", "scale-100", "pointer-events-auto");

                // Reset style
                notifyDropdown.style.opacity = '';
                notifyDropdown.style.pointerEvents = '';
                notifyDropdown.style.transform = '';

                isDropdownOpen = false;
            }
        });

        // Đóng khi click ra ngoài
        document.addEventListener("click", (e) => {
            if (isDropdownOpen && !notifyButton.contains(e.target) && !notifyDropdown.contains(e.target)) {
                notifyDropdown.classList.add("opacity-0", "scale-95", "pointer-events-none");
                notifyDropdown.classList.remove("opacity-100", "scale-100", "pointer-events-auto");
                notifyDropdown.style.opacity = '';
                isDropdownOpen = false;
            }
        });
    } else {
    }

    // --- 6. SỰ KIỆN CÁC NÚT CON ---

    if (refreshIdleBtn) {
        refreshIdleBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            console.log("🔄 Refresh clicked");
            const icon = refreshIdleBtn.querySelector("svg");
            if (icon) icon.classList.add("animate-spin");

            isIdleLoaded = false;
            loadIdleUsers().then(() => {
                if (icon) icon.classList.remove("animate-spin");
            });
        });
    }

    if (tabIdle) {
        tabIdle.addEventListener("click", (e) => {
            e.stopPropagation();
            switchToIdleTab();
        });
    }

    if (tabAll) {
        tabAll.addEventListener("click", (e) => {
            e.stopPropagation();
            // Giữ nguyên ở tab Idle, không cho chuyển
        });
    }
});