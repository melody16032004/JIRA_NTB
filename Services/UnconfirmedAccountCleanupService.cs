using JIRA_NTB.Models;
using Microsoft.AspNetCore.Identity;
using System.Collections.Concurrent;

namespace JIRA_NTB.Services
{
	public class UnconfirmedAccountCleanupService : BackgroundService
	{
		private readonly IServiceProvider _serviceProvider;
		private static readonly ConcurrentDictionary<string, DateTime> _pendingAccounts = new();

		public UnconfirmedAccountCleanupService(IServiceProvider serviceProvider)
		{
			_serviceProvider = serviceProvider;
		}

		public static void AddPendingAccount(string userId)
		{
			_pendingAccounts.TryAdd(userId, DateTime.UtcNow);
		}

		public static void RemovePendingAccount(string userId)
		{
			_pendingAccounts.TryRemove(userId, out _);
		}

		protected override async Task ExecuteAsync(CancellationToken stoppingToken)
		{
			while (!stoppingToken.IsCancellationRequested)
			{
				try
				{
					using (var scope = _serviceProvider.CreateScope())
					{
						var userManager = scope.ServiceProvider.GetRequiredService<UserManager<UserModel>>();

						var now = DateTime.UtcNow;
						var accountsToRemove = new List<string>();

						foreach (var account in _pendingAccounts)
						{
							var elapsedTime = now - account.Value;

							// Nếu đã hơn 10 phút và chưa xác nhận email
							if (elapsedTime.TotalMinutes > 11)
							{
								var user = await userManager.FindByIdAsync(account.Key);
								if (user != null && !user.EmailConfirmed)
								{
									// Xóa tài khoản
									await userManager.DeleteAsync(user);
									accountsToRemove.Add(account.Key);
								}
								else if (user != null && user.EmailConfirmed)
								{
									// Đã xác nhận rồi thì remove khỏi danh sách pending
									accountsToRemove.Add(account.Key);
								}
								else
								{
									// User không tồn tại nữa
									accountsToRemove.Add(account.Key);
								}
							}
						}

						// Loại bỏ các account đã xử lý
						foreach (var userId in accountsToRemove)
						{
							_pendingAccounts.TryRemove(userId, out _);
						}
					}
				}
				catch (Exception ex)
				{
					// Log lỗi nếu cần
					Console.WriteLine($"Error in UnconfirmedAccountCleanupService: {ex.Message}");
				}

				// Kiểm tra mỗi 5 giây
				await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
			}
		}
	}
}
