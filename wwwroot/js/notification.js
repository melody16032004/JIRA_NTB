// ===============================
// -----| /js/notification.js |-------
// ===============================

// --- STATE TOÀN CỤC & DOM ELEMENTS ---
let currentMe = null;
const notifyList = document.getElementById("notifyList"); // << UL chứa nội dung cuộn
const notifyButton = document.getElementById("notifyButton");
const notifyBadge = document.getElementById("notifyBadge");
const clearBtn = document.getElementById("clearNotify");
const notifyDropdownContainer = document.getElementById("notifyDropdownContainer"); // << DIV bên ngoài

// SỬA: Đổi pageSize (bạn đã đổi thành 5)
let notifyState = {
    pageIndex: 1,
    pageSize: 5, // Page size (theo yêu cầu)
    totalPages: 1,
    isLoading: false
};

// ================================
// HÀM HELPER (DATA)
// ================================
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

function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.round((now - date) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);

    if (seconds < 60) return "Vừa xong";
    if (minutes < 60) return `${minutes} phút trước`;
    if (hours < 24) return `${hours} giờ trước`;
    return `${days} ngày trước`;
}

function mapNotificationData(n) {
    const title = n.title.toLowerCase();
    let icon = "info";
    let color = "text-indigo-400";

    // (Logic map icon của bạn giữ nguyên)
    if (title.includes("quá hạn") || title.includes("overdue") || title.includes("trễ")) {
        icon = "alert-triangle";
        color = "text-red-500";
    }
    else if (title.includes("lỗi") || title.includes("error") || title.includes("thất bại")) {
        icon = "server-crash";
        color = "text-red-600";
    }
    else if (title.includes("bảo mật") || title.includes("security") || title.includes("mật khẩu")) {
        icon = "shield-alert";
        color = "text-red-600";
    }
    else if (title.includes("hoàn thành") || title.includes("done") || title.includes("completed") || title.includes("đã xong")) {
        icon = "check-circle-2";
        color = "text-green-400";
    }
    else if (title.includes("giao task") || title.includes("giao việc") || title.includes("assigned") || title.includes("giao")) {
        icon = "clipboard-list";
        color = "text-blue-400";
    }
    else if (title.includes("nhắc tên") || title.includes("mention") || title.includes("@")) {
        icon = "at-sign";
        color = "text-purple-400";
    }
    else if (title.includes("yêu cầu") || title.includes("request") || title.includes("duyệt")) {
        icon = "clipboard-check";
        color = "text-orange-400";
    }
    else if (title.includes("phòng ban") || title.includes("department")) {
        icon = "building";
        color = "text-cyan-500";
    }
    else if (title.includes("tài khoản") || title.includes("account") || title.includes("người dùng mới")) {
        icon = "user-plus";
        color = "text-pink-400";
    }
    else if (title.includes("thành viên") || title.includes("member") || title.includes("người dùng")) {
        icon = "users";
        color = "text-pink-400";
    }
    else if (title.includes("quyền") || title.includes("permission") || title.includes("vai trò")) {
        icon = "user-cog";
        color = "text-orange-400";
    }
    else if (title.includes("cập nhật") || title.includes("update") || title.includes("thay đổi") || title.includes("edit")) {
        icon = "pencil";
        color = "text-yellow-500";
    }
    else if (title.includes("bình luận") || title.includes("comment")) {
        icon = "message-circle";
        color = "text-gray-300";
    }
    else if (title.includes("tin nhắn") || title.includes("message")) {
        icon = "message-square";
        color = "text-yellow-400";
    }
    else if (title.includes("họp") || title.includes("meeting") || title.includes("lịch")) {
        icon = "calendar-days";
        color = "text-pink-400";
    }
    else if (title.includes("file") || title.includes("tệp") || title.includes("upload")) {
        icon = "paperclip";
        color = "text-cyan-400";
    }
    else if (title.includes("dự án") || title.includes("project")) {
        icon = "folder-git-2";
        color = "text-green-400";
    }
    else if (title.includes("bảo trì") || title.includes("system") || title.includes("hệ thống")) {
        icon = "server-cog";
        color = "text-gray-400";
    }
    return { icon, color };
}


// ================================
// HÀM HELPER (UI)
// ================================
function updateNotifyCount() {
    if (!notifyList || !notifyBadge) return;
    const unread = notifyList.querySelectorAll("li.unread").length;
    notifyBadge.style.display = unread > 0 ? "flex" : "none";
    notifyBadge.textContent = unread > 0 ? unread : "";
}

function triggerShake() {
    if (!notifyButton || !notifyBadge) return;
    if (notifyBadge.style.display !== "none") {
        notifyButton.classList.add("shake");
        setTimeout(() => notifyButton.classList.remove("shake"), 700);
    }
}

function appendNotificationHTML(n, position = 'beforeend') {
    if (!notifyList) return;
    const dot = n.unread
        ? `<span class="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>`
        : "";

    const unreadClass = n.unread ? "unread" : "";
    const timeColor = n.unread ? "text-gray-400" : "text-gray-500";

    const html = `
        <li class="p-3 hover:bg-gray-700/50 transition flex items-start space-x-3 cursor-pointer ${unreadClass}" data-id="${n.id}">
            <div class="relative">
                <i data-lucide="${n.icon}" class="w-5 h-5 ${n.color} mt-0.5"></i>
                ${dot}
            </div>
            <div>
                <p class="text-sm text-gray-200">${n.message}</p>
                <span class="text-xs ${timeColor}">${n.time}</span>
            </div>
        </li>
    `;

    notifyList.insertAdjacentHTML(position, html);
}

function clearNoNotifyMessage() {
    const noNotify = notifyList.querySelector("li.text-gray-500");
    if (noNotify) noNotify.remove();
}
function addNotificationToList(n) {
    clearNoNotifyMessage();

    appendNotificationHTML(n, 'afterbegin');
    lucide.createIcons();
}


// ================================
// HÀM TẢI DỮ LIỆU (Hỗ trợ phân trang)
// ================================
async function loadNotifications(userId, pageIndex = 1) {
    if (notifyState.isLoading) return;
    notifyState.isLoading = true;

    if (!notifyList) return;

    const loaderId = "notify-loader";
    if (pageIndex === 1) {
        notifyList.innerHTML = `<li id="${loaderId}" class="p-4 text-center text-gray-500 text-xs">Đang tải...</li>`;
    } else if (!document.getElementById(loaderId)) {
        notifyList.insertAdjacentHTML('beforeend', `<li id="${loaderId}" class="p-4 text-center text-gray-500 text-xs">Đang tải thêm...</li>`);
    }

    //console.log(`Đang tải thông báo trang ${pageIndex} cho user: ${userId}`);
    const data = await safeFetchJson(`/api/notification/${userId}?pageIndex=${pageIndex}&pageSize=${notifyState.pageSize}`, { items: [], totalPages: 1 });

    const loaderEl = document.getElementById(loaderId);
    if (loaderEl) loaderEl.remove();

    if (pageIndex === 1) {
        notifyList.innerHTML = "";
    }

    clearNoNotifyMessage();

    notifyState.pageIndex = data.pageIndex || pageIndex; // Cập nhật trang hiện tại
    notifyState.totalPages = data.totalPages || 1; // Cập nhật tổng số trang
    notifyState.isLoading = false;

    if ((!data.items || data.items.length === 0) && pageIndex === 1) {
        notifyList.innerHTML = "<li class='p-4 text-center text-gray-500'>Không có thông báo mới.</li>";
        updateNotifyCount();
        return;
    }

    data.items.forEach(n => {
        const mappedData = mapNotificationData(n);
        const timeAgo = formatTimeAgo(n.createdAt);

        appendNotificationHTML({
            id: n.id,
            ...mappedData,
            message: n.message,
            time: timeAgo,
            unread: !n.isRead
        }, 'beforeend');
    });

    lucide.createIcons();

    updateNotifyCount();
}


// ================================
// ENTRY POINT (KHỞI CHẠY)
// ================================
document.addEventListener("DOMContentLoaded", async () => {

    // 1. LẤY THÔNG TIN NGƯỜI DÙNG
    if (!currentMe) {
        try {
            const meRes = await fetch("/api/user/me", { credentials: 'include' });
            if (meRes.ok) {
                currentMe = await meRes.json();
            }
        } catch (e) {
            console.error("Fetch failed:", e);
        }
    }
    if (!currentMe || currentMe.id == null) {
        window.location.href = "/Error/403";
        return;
    }
    //console.log("Me:", currentMe);


    // 2. KẾT NỐI SIGNALR (CHO NOTIFY MỚI)
    const connection = new signalR.HubConnectionBuilder()
        .withUrl(`/notifyHub?userId=${currentMe.id}`)
        .configureLogging(signalR.LogLevel.Warning)
        .build();

    connection.on("ReceiveNotification", (data) => {
        //console.log("Realtime notify:", data);

        const mappedData = mapNotificationData(data);

        addNotificationToList({
            id: data.id,
            ...mappedData,
            message: data.message,
            time: "Vừa xong",
            unread: true
        });

        updateNotifyCount();
        triggerShake();
    });

    connection.start().catch(err => console.error(err.toString()));


    // 3. TẢI DỮ LIỆU CŨ (TRANG 1) TỪ API
    await loadNotifications(currentMe.id, 1);

    // 4. GẮN CÁC EVENT LISTENER CHO POPUP
    if (notifyButton && notifyBadge && notifyList && clearBtn) {

        // Đánh dấu 1 thông báo là đã đọc (Client + Server)
        notifyList.addEventListener("click", async (e) => {
            const li = e.target.closest("li.unread");
            if (!li) return;

            const notificationId = li.dataset.id;
            li.classList.remove("unread");
            const redDot = li.querySelector("span.bg-red-500");
            if (redDot) redDot.remove();
            updateNotifyCount();

            if (notificationId) {
                try {
                    await fetch(`/api/notification/read/${notificationId}`, {
                        method: 'POST',
                        credentials: 'include'
                    });
                    //console.log(`Đã đánh dấu ${notificationId} là đã đọc.`);
                } catch (err) {
                    console.error("Lỗi khi đánh dấu đã đọc (single):", err);
                }
            }
        });

        // Đánh dấu tất cả là đã đọc (Client + Server)
        clearBtn.addEventListener("click", async () => {
            notifyList.querySelectorAll("li.unread").forEach((li) => {
                li.classList.remove("unread");
                const dot = li.querySelector("span.bg-red-500");
                if (dot) dot.remove();
            });
            updateNotifyCount();

            try {
                await fetch(`/api/notification/read-all/${currentMe.id}`, {
                    method: 'POST',
                    credentials: 'include'
                });
                //console.log("Đã đánh dấu tất cả là đã đọc (server).");
            } catch (err) {
                console.error("Lỗi khi đánh dấu đã đọc:", err);
            }
        });

        // Lặp lại shake (2 giây 1 lần)
        setInterval(() => {
            if (notifyBadge.style.display !== "none") triggerShake();
        }, 2000);

        // ========================================================
        // SỬA: Gắn sự kiện SCROLL cho infinite loading
        // ========================================================
        // SỬA: Gắn vào 'notifyList' (UL), không phải 'notifyDropdownContainer' (DIV)
        const scrollContainer = document.getElementById("notifyDropdownContainer");

        if (scrollContainer) {
            scrollContainer.addEventListener('scroll', () => {

                // 1. Kiểm tra xem đang ở Tab nào?
                // Nếu notifyList đang bị ẩn (đang ở Tab Nhàn rỗi) thì KHÔNG tải thêm notify
                if (notifyList.classList.contains('hidden')) return;

                // 2. Lấy thông số từ container bao ngoài
                const { scrollTop, scrollHeight, clientHeight } = scrollContainer;

                // 3. Kiểm tra điều kiện (không đang tải, và chưa hết trang)
                if (notifyState.isLoading || notifyState.pageIndex >= notifyState.totalPages) {
                    return;
                }

                // 4. Gần chạm đáy (cách 50px)
                if (scrollTop + clientHeight >= scrollHeight - 50) {
                    //console.log("Đang tải thêm thông báo (Infinite Scroll)...");
                    loadNotifications(currentMe.id, notifyState.pageIndex + 1);
                }
            });
        }
    }
});


// ========================================================
// MỚI: XỬ LÝ CHUYỂN TAB (TẤT CẢ <-> NHÀN RỖI)
// ========================================================
const tabAll = document.getElementById("tabAll");
const tabIdle = document.getElementById("tabIdle"); // Đây là button thường, không phải wrapper
const idleList = document.getElementById("idleList");

const notifyToolbar = document.getElementById("notifyToolbar");
const refreshIdleBtn = document.getElementById("refreshIdleBtn"); // Nút refresh

let isIdleLoaded = false;

// 1. Hàm tải dữ liệu
async function loadIdleUsers() {
    if (isIdleLoaded) return;

    // Hiển thị loader
    idleList.innerHTML = `<div class="p-6 text-center text-gray-500 text-xs flex flex-col items-center gap-2">
                            <i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i>
                            <span>Đang tìm nhân sự rảnh...</span>
                          </div>`;
    lucide.createIcons();

    try {
        const data = await safeFetchJson("/api/notification/users/idle", []);
        idleList.innerHTML = ""; // Xóa loader

        if (!data || data.length === 0) {
            idleList.innerHTML = `
                <div class="p-6 text-center text-gray-500">
                    <div class="flex flex-col items-center gap-2">
                        <i data-lucide="briefcase" class="w-8 h-8 text-gray-600"></i>
                        <p class="text-sm">Không có nhân sự nào đang nhàn rỗi.</p>
                        <p class="text-xs text-gray-600">Tất cả đều đang có task.</p>
                    </div>
                </div>`;
            lucide.createIcons();
            return;
        }

        //console.log("Idle users:", data);
        const ul = document.createElement("ul");
        ul.className = "divide-y divide-gray-700";


        data.forEach(u => {
            let colorText = ``;
            if (u.dayLeft <= 2) {
                colorText = `text-green-400`
            }
            else if (u.dayLeft <= 5) {
                colorText = `text-orange-400`
            }
            else if (u.dayLeft <= 10) {
                colorText = `text-red-400`
            } else {
                colorText = `text-gray-400`
            }

            let leftDays = ``;
            if (u.dayLeft < 0 || u.dayLeft == null) {
                // Số âm -> Đã rảnh từ lâu
                leftDays = `<span class="text-green-400 font-bold">[Đang rảnh]</span>`;
            }
            else if (u.dayLeft === 0) {
                leftDays = `<span class="text-yellow-400 font-bold">(Rảnh vào ngày mai)</span>`;
            }
            else if (u.dayLeft === 1) {
                leftDays = `<span class="text-orange-400 font-bold">(Rảnh vào ngày kia)</span>`;
            }
            else {
                leftDays = `<span class="text-red-400 font-bold">(Bận thêm ${u.dayLeft} ngày)</span>`;
            }
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
        lucide.createIcons();
        isIdleLoaded = true;

    } catch (err) {
        console.error("Lỗi tải idle users:", err);
        idleList.innerHTML = `<div class="p-4 text-center text-red-400 text-xs">Lỗi tải dữ liệu.</div>`;
    }
}

// 2. Xử lý chuyển Tab
// Kiểm tra xem tabIdle có tồn tại không (vì Employee không có)
if (tabAll && tabIdle && idleList) {

    const switchTab = (tabName) => {
        // Luôn hiện toolbar
        if (notifyToolbar) notifyToolbar.classList.remove("hidden");

        // Hàm hiển thị có hiệu ứng
        const showWithAnimation = (elToShow, elToHide) => {
            // 1. Ẩn ngay lập tức phần tử cũ (để tránh vỡ layout)
            elToHide.classList.add("hidden");
            elToHide.classList.remove("opacity-100", "translate-x-0");
            elToHide.classList.add("opacity-0", "translate-x-4"); // Đẩy sang phải và làm mờ

            // 2. Chuẩn bị phần tử mới (bỏ hidden nhưng vẫn mờ)
            elToShow.classList.remove("hidden");

            // 3. Kích hoạt animation sau 1 khoảng cực ngắn (để browser kịp render DOM)
            setTimeout(() => {
                elToShow.classList.remove("opacity-0", "translate-x-4");
                elToShow.classList.add("opacity-100", "translate-x-0");
            }, 20);
        };

        if (tabName === 'all') {
            // --- UI Tabs ---
            tabAll.classList.add("text-indigo-400", "border-indigo-500");
            tabAll.classList.remove("text-gray-400", "border-transparent");

            tabIdle.classList.add("text-gray-400", "border-transparent");
            tabIdle.classList.remove("text-indigo-400", "border-indigo-500");

            // --- Toolbar Buttons ---
            if (clearBtn) clearBtn.classList.remove("hidden");
            if (refreshIdleBtn) refreshIdleBtn.classList.add("hidden");

            // --- ANIMATION: Hiện List, Ẩn Idle ---
            showWithAnimation(notifyList, idleList);
        }
        else if (tabName === 'idle') {
            // --- UI Tabs ---
            tabIdle.classList.add("text-indigo-400", "border-indigo-500");
            tabIdle.classList.remove("text-gray-400", "border-transparent");

            tabAll.classList.add("text-gray-400", "border-transparent");
            tabAll.classList.remove("text-indigo-400", "border-indigo-500");

            // --- Toolbar Buttons ---
            if (clearBtn) clearBtn.classList.add("hidden");
            if (refreshIdleBtn) refreshIdleBtn.classList.remove("hidden");

            // --- ANIMATION: Hiện Idle, Ẩn List ---
            showWithAnimation(idleList, notifyList);

            // Gọi API
            loadIdleUsers();
        }
    };

    tabAll.addEventListener("click", (e) => {
        e.stopPropagation();
        switchTab('all');
    });

    tabIdle.addEventListener("click", (e) => {
        e.stopPropagation();
        switchTab('idle');
    });

    // Sự kiện click cho nút Refresh
    if (refreshIdleBtn) {
        refreshIdleBtn.addEventListener("click", (e) => {
            e.stopPropagation();

            // Hiệu ứng xoay icon
            const icon = refreshIdleBtn.querySelector("svg");
            if (icon) icon.classList.add("animate-spin");

            // Reset cờ và tải lại
            isIdleLoaded = false;
            loadIdleUsers().then(() => {
                if (icon) icon.classList.remove("animate-spin");
            });
        });
    }
}
else {
    // Fallback cho Employee (người không thấy tab Idle)
    if (notifyList) notifyList.classList.remove("hidden");
    if (idleList) idleList.classList.add("hidden");
    // Đảm bảo toolbar và nút Clear hiện
    if (notifyToolbar) notifyToolbar.classList.remove("hidden");
    if (clearBtn) clearBtn.classList.remove("hidden");
    if (refreshIdleBtn) refreshIdleBtn.classList.add("hidden");
}