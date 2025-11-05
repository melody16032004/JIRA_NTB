using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace JIRA_NTB.Utilities
{
	public class PaginatedList<T>
	{
		public List<T> Items { get; private set; }
		public int PageIndex { get; private set; }
		public int TotalPages { get; private set; }
		public int TotalCount { get; private set; }

		public PaginatedList(List<T> items, int count, int pageIndex, int pageSize)
		{
			PageIndex = pageIndex;
			TotalCount = count;
			TotalPages = (int)Math.Ceiling(count / (double)pageSize);
			this.Items = items;
		}

		public bool HasPreviousPage => PageIndex > 1;
		public bool HasNextPage => PageIndex < TotalPages;
	}
	public static class PaginationExtensions
	{
		// Thêm "this IQueryable<T> source"
		// Đổi tên hàm cho chuẩn "Extension Method"
		public static async Task<PaginatedList<T>> ToPaginatedListAsync<T>(this IQueryable<T> source, int pageIndex, int pageSize)
		{
			var count = await source.CountAsync();
			var items = await source.Skip((pageIndex - 1) * pageSize)
									.Take(pageSize)
									.ToListAsync();

			return new PaginatedList<T>(items, count, pageIndex, pageSize);
		}
	}
}
