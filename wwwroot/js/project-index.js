// =========================================
// 1. LOGIC: Lọc danh sách dự án
// =========================================
// (Phần này vẫn cần $(function) vì nó thao tác trực tiếp với DOM khi tải trang)
$(function () {
    $("#filter-form").on("change", "select, input[type='text']", function () {
        setTimeout(function () {
            $.get("/Project/Index", $("#filter-form").serialize(), function (data) {
                $("#project-list").html(data);
                lucide.createIcons(); // Khởi tạo lại icon sau khi load lại danh sách
            });
        }, 500);
    });
});

// =========================================
// 2. LOGIC: Gợi ý thành viên (#mention)
// =========================================
$(function () {
    let suggestionUsers = [];

    function initializeMentionHandler(leaderSelectId, textareaId, mentionBoxId) {
        const $leaderSelect = $(leaderSelectId);
        const $textarea = $(textareaId);

        // Chỉ tạo box nếu nó chưa tồn tại (tránh tạo trùng lặp khi load lại trang bằng Ajax nếu có)
        if ($(`#${mentionBoxId}`).length === 0) {
            $(`<div id="${mentionBoxId}"></div>`).css({
                position: 'absolute', display: 'none', zIndex: 9999,
                background: 'white', border: '1px solid #ddd', borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)', maxHeight: '220px', overflowY: 'auto',
                width: 'auto', minWidth: '250px', maxWidth: '350px',
                whiteSpace: 'nowrap', overflowX: 'hidden', textOverflow: 'ellipsis'
            }).appendTo('body');
        }
        const $box = $(`#${mentionBoxId}`);

        function hideBox() { $box.hide(); }
        function showBox(html, left, top, width) {
            const screenWidth = $(window).width();
            if (left + 300 > screenWidth) {
                left = screenWidth - 310;
            }
            $box.html(html).css({ left, top, width: 'auto' }).show();
        }

        // Dùng 'on' với delegation cho body để đảm bảo sự kiện vẫn hoạt động
        // ngay cả khi các phần tử modal bị replace hoặc re-render.
        $('body').on('change', leaderSelectId, function () {
            const leaderId = $(this).val();
            if (!leaderId) {
                suggestionUsers = [];
                return;
            }
            $.get('/Project/GetUsersByLeader', { leaderId: leaderId }, function (res) {
                suggestionUsers = res.success ? res.users : [];
            });
        });

        $('body').on('keyup click', textareaId, function (e) {
            const ta = this;
            const textBefore = ta.value.substring(0, ta.selectionStart);
            const atPos = textBefore.lastIndexOf('#');

            if (atPos === -1) { hideBox(); return; }
            const query = textBefore.substring(atPos + 1).trim().toLowerCase();
            if (query.length === 0 && !textBefore.endsWith('#')) { hideBox(); return; }

            const matches = suggestionUsers.filter(u =>
                (u.userName && u.userName.toLowerCase().includes(query)) ||
                (u.fullName && u.fullName.toLowerCase().includes(query))
            );

            if (matches.length === 0) { hideBox(); return; }

            const html = matches.map(u => `
                <div class="px-4 py-2 hover:bg-indigo-50 cursor-pointer flex items-center gap-3 transition-colors duration-150" data-username="${u.userName}">
                    <img src="${u.avatar || '/images/default-avatar.png'}" class="w-8 h-8 rounded-full border border-gray-200 object-cover">
                    <div class="flex flex-col overflow-hidden">
                        <span class="font-medium text-gray-900 truncate">${u.fullName || u.userName}</span>
                        <span class="text-gray-500 text-xs truncate">#${u.userName}</span>
                    </div>
                </div>
            `).join('');

            const rect = ta.getBoundingClientRect();
            showBox(html, rect.left + window.scrollX, rect.bottom + window.scrollY + 5, $(ta).outerWidth());
        });

        // Sự kiện click chọn user từ box gợi ý
        $box.on('click', '[data-username]', function (e) {
            e.preventDefault(); e.stopPropagation();
            const username = $(this).data('username');
            const $ta = $(textareaId);
            const ta = $ta[0]; // Lấy DOM element thật

            const textBefore = ta.value.substring(0, ta.selectionStart);
            const atPos = textBefore.lastIndexOf('#');
            if (atPos === -1) return false;

            ta.value = textBefore.substring(0, atPos + 1) + username + ' #' + ta.value.substring(ta.selectionStart);

            ta.focus();
            $ta.trigger('keyup');
            return false;
        });

        $(document).on('click', function (e) {
            if (!$(e.target).closest(`#${mentionBoxId}, ${textareaId}`).length) hideBox();
        });
    }

    initializeMentionHandler("#leaderSelect", "#projectMembers", "createMentionBox");
    initializeMentionHandler("#edit_leaderSelect", "#edit_projectMembers", "editMentionBox");
});

// =========================================
// 3. LOGIC: Sửa và Xóa (CRUD) - QUAN TRỌNG NHẤT
// =========================================
// KHÔNG ĐƯỢC BỌC CÁI NÀY TRONG $(function() {})
document.addEventListener('alpine:init', () => {
    // Alpine đã sẵn sàng. Bây giờ ta có thể an tâm gán các sự kiện click.

    // Hàm helper để lấy Alpine component mới nhất mỗi khi cần
    // Hàm helper để lấy Alpine component an toàn (TÌM THEO ID)
    function getAlpineComponent() {
        // Tìm chính xác thẻ div theo ID chúng ta vừa gán
        const el = document.getElementById('main-project-app');

        if (!el || !el.__x) {
            console.error("❌ LỖI: Không tìm thấy Alpine component có ID 'main-project-app'. Hãy chắc chắn bạn đã thêm id=\"main-project-app\" vào thẻ div x-data trong Index.cshtml");
            return null;
        }
        return el.__x.data;
    }

    // --- XỬ LÝ NÚT SỬA ---
    // Dùng $(document).on('click', ...) để đảm bảo nó luôn hoạt động
    // kể cả khi danh sách dự án bị replace bởi AJAX lọc.
    $(document).on('click', '.edit-project-btn', function (e) {
        e.preventDefault();
        const projectId = $(this).data('id');

        $.get('/Project/GetProjectForEdit', { id: projectId }, function (data) {
            if (data) {
                // Fill dữ liệu vào Modal Sửa
                $('#edit_idProject').val(data.idProject);
                $('#edit_projectName').val(data.projectName);
                $('#edit_startDay').val(data.startDay);
                $('#edit_endDay').val(data.endDay);
                $('#edit_departmentSelect').val(data.departmentId);
                $('#edit_leaderSelect').val(data.userId);
                $('#edit_projectMembers').val(data.membersInput);
                $('#edit_statusId').val(data.statusId);
                $('#edit_note').val(data.note);

                // Kích hoạt 'change' để load trước danh sách user cho gợi ý
                $('#edit_leaderSelect').trigger('change');

                // Mở modal (Lấy component ngay lúc này để chắc chắn nó tồn tại)
                const alpine = getAlpineComponent();
                if (alpine) {
                    alpine.isEditModalOpen = true;
                    // Fix lỗi icon có thể không hiển thị ngay trong modal mới mở
                    setTimeout(() => lucide.createIcons(), 50);
                } else {
                    console.error("Alpine component not found.");
                }
            }
        }).fail(function () {
            alert("Lỗi: Không thể tải thông tin dự án từ server.");
        });
    });

    // --- XỬ LÝ NÚT XÓA ---
    $(document).on('click', '.delete-project-btn', function (e) {
        e.preventDefault();
        const $btn = $(this);
        const projectId = $btn.data('id');
        const projectName = $btn.data('name');

        // Lấy token từ form nào cũng được, miễn là có trong trang
        const token = $('input[name="__RequestVerificationToken"]').first().val();

        if (!confirm(`Bạn có chắc chắn muốn xóa dự án "${projectName}"?`)) {
            return;
        }

        $.post('/Project/Delete/' + projectId, { __RequestVerificationToken: token }, function (response) {
            if (response.success) {
                // Hiệu ứng xóa thẻ dự án
                $btn.closest('.project-card').fadeOut(300, function () {
                    $(this).remove();
                });
            } else {
                alert("Không thể xóa: " + response.message);
            }
        }).fail(function (xhr, status, error) {
            console.error("Delete failed:", error);
            alert("Lỗi kết nối: Không thể gọi đến server để xóa.");
        });
    });
});