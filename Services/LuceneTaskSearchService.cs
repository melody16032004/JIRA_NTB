using JIRA_NTB.Data;
using Lucene.Net.Analysis;
using Lucene.Net.Analysis.Standard;
using Lucene.Net.Documents;
using Lucene.Net.Index;
using Lucene.Net.Search;
using Lucene.Net.Store;
using Lucene.Net.Util;
using System.Globalization;
using System.Text;
// KHÔNG import System.IO ở đây

namespace JIRA_NTB.Services
{
    public class LuceneTaskSearchService : ITaskSearchService
    {
        private readonly string _indexPath;
        private readonly Analyzer _analyzer = new StandardAnalyzer(LuceneVersion.LUCENE_48);

        public LuceneTaskSearchService(IWebHostEnvironment env)
        {
            _indexPath = System.IO.Path.Combine(
                env.WebRootPath ?? throw new ArgumentNullException(nameof(env.WebRootPath)),
                "lucene_index");

            // tạo folder nếu chưa tồn tại - dùng System.IO.Directory
            if (!System.IO.Directory.Exists(_indexPath))
                System.IO.Directory.CreateDirectory(_indexPath);
        }

        public async Task<List<TaskSuggestionDto>> SuggestAsync(string keyword, string? projectId)
        {
            if (string.IsNullOrWhiteSpace(keyword))
                return new List<TaskSuggestionDto>();

            keyword = keyword.ToLower();
            var keywordNoSign = RemoveDiacritics(keyword);

            var dir = FSDirectory.Open(new DirectoryInfo(_indexPath));
            if (!DirectoryReader.IndexExists(dir))
                return new List<TaskSuggestionDto>();

            using var reader = DirectoryReader.Open(dir);
            var searcher = new IndexSearcher(reader);

            // Query 1: match chính xác / wildcard có dấu
            var q1 = new WildcardQuery(new Term("NormalizedName", "*" + keyword + "*"));

            // Query 2: match không dấu
            var q2 = new WildcardQuery(new Term("NameNoDiacritics", "*" + keywordNoSign + "*"));

            // Gom 2 query vào
            var booleanQuery = new BooleanQuery
            {
                { q1, Occur.SHOULD },
                { q2, Occur.SHOULD }
            };

            var hits = searcher.Search(booleanQuery, 20).ScoreDocs;

            var results = hits
                .Select(h => searcher.Doc(h.Doc))
                .Where(doc => string.IsNullOrEmpty(projectId) || doc.Get("ProjectId") == projectId)
                .Select(doc => new TaskSuggestionDto(doc.Get("Name")))
                .DistinctBy(x => x.FullName)
                .ToList();

            return results;
        }

        public async Task<TaskEntity?> FindByFullNameAsync(string fullName, string? projectId)
        {
            if (string.IsNullOrWhiteSpace(fullName))
                return null;

            var normalized = fullName.ToLower();
            var dir = FSDirectory.Open(new DirectoryInfo(_indexPath));

            if (!DirectoryReader.IndexExists(dir))
                return null;

            using var reader = DirectoryReader.Open(dir);
            var searcher = new IndexSearcher(reader);

            var query = new TermQuery(new Term("NormalizedName", normalized));
            var hits = searcher.Search(query, 5).ScoreDocs;

            foreach (var hit in hits)
            {
                var doc = searcher.Doc(hit.Doc);
                if (string.IsNullOrEmpty(projectId) || doc.Get("ProjectId") == projectId)
                {
                    return new TaskEntity
                    {
                        Id = doc.Get("Id"),
                        Name = doc.Get("Name"),
                        ProjectId = doc.Get("ProjectId")
                    };
                }
            }

            return null;
        }

        // Thêm phương thức để index dữ liệu
        public async Task IndexTaskAsync(TaskEntity task)
        {
            var dir = FSDirectory.Open(new DirectoryInfo(_indexPath));
            var config = new IndexWriterConfig(LuceneVersion.LUCENE_48, _analyzer);

            using var writer = new IndexWriter(dir, config);

            var doc = new Document
        {
            new StringField("Id", task.Id.ToString(), Field.Store.YES),
            new TextField("Name", task.Name, Field.Store.YES),
            new StringField("NormalizedName", task.Name.ToLower(), Field.Store.YES),
            new StringField("ProjectId", task.ProjectId ?? "", Field.Store.YES),
            new StringField("NameNoDiacritics", RemoveDiacritics(task.Name).ToLower(), Field.Store.YES)
        };

            writer.UpdateDocument(new Term("Id", task.Id.ToString()), doc);
            writer.Commit();
        }

        public static string RemoveDiacritics(string text)
        {
            if (string.IsNullOrEmpty(text)) return text;

            var normalized = text.Normalize(NormalizationForm.FormD);
            var sb = new StringBuilder();

            foreach (var c in normalized)
            {
                var unicodeCategory = CharUnicodeInfo.GetUnicodeCategory(c);
                if (unicodeCategory != UnicodeCategory.NonSpacingMark)
                {
                    sb.Append(c);
                }
            }

            return sb.ToString().Normalize(NormalizationForm.FormC);
        }
        // Phương thức để index nhiều task cùng lúc (hiệu quả hơn)
        public async Task IndexTasksAsync(IEnumerable<TaskEntity> tasks)
        {
            var dir = FSDirectory.Open(new System.IO.DirectoryInfo(_indexPath));
            var config = new IndexWriterConfig(LuceneVersion.LUCENE_48, _analyzer);

            using var writer = new IndexWriter(dir, config);

            foreach (var task in tasks)
            {
                var doc = new Document
                {
                    new StringField("Id", task.Id.ToString(), Field.Store.YES),
                    new TextField("Name", task.Name, Field.Store.YES),
                    new StringField("NormalizedName", task.Name.ToLower(), Field.Store.YES),
                    new StringField("ProjectId", task.ProjectId ?? "", Field.Store.YES),
                    new StringField("NameNoDiacritics", RemoveDiacritics(task.Name).ToLower(), Field.Store.YES)
                };

                writer.AddDocument(doc);
            }

            writer.Commit();
        }
        public async Task<List<TaskSuggestionDto>> FuzzySearchAsync(string keyword, string? projectId)
        {
            if (string.IsNullOrWhiteSpace(keyword))
                return new List<TaskSuggestionDto>();

            keyword = keyword.ToLower();
            var keywordNoSign = RemoveDiacritics(keyword);

            var dir = FSDirectory.Open(new DirectoryInfo(_indexPath));
            if (!DirectoryReader.IndexExists(dir))
                return new List<TaskSuggestionDto>();

            using var reader = DirectoryReader.Open(dir);
            var searcher = new IndexSearcher(reader);

            var q1 = new FuzzyQuery(new Term("NormalizedName", keyword), maxEdits: 2);
            var q2 = new FuzzyQuery(new Term("NameNoDiacritics", keywordNoSign), maxEdits: 2);

            var booleanQuery = new BooleanQuery
            {
                { q1, Occur.SHOULD },
                { q2, Occur.SHOULD }
            };

            var hits = searcher.Search(booleanQuery, 20).ScoreDocs;

            var results = hits
                .Select(h => searcher.Doc(h.Doc))
                .Where(doc => string.IsNullOrEmpty(projectId) || doc.Get("ProjectId") == projectId)
                .Select(doc => new TaskSuggestionDto(doc.Get("Name")))
                .DistinctBy(x => x.FullName)
                .ToList();

            return results;
        }
        public async Task<List<TaskSuggestionDto>> SmartSuggestAsync(string keyword, string? projectId)
        {
            var normal = await SuggestAsync(keyword, projectId);
            var fuzzy = await FuzzySearchAsync(keyword, projectId);

            return normal
                .Concat(fuzzy)
                .DistinctBy(x => x.FullName)
                .Take(20)
                .ToList();
        }
        public async Task UpdateIndexAsync(TaskEntity task)
        {
            var dir = FSDirectory.Open(new DirectoryInfo(_indexPath));
            var config = new IndexWriterConfig(LuceneVersion.LUCENE_48, _analyzer);
            using var writer = new IndexWriter(dir, config);

            // Xóa index cũ theo Id
            writer.DeleteDocuments(new Term("Id", task.Id));

            // Index lại
            var doc = new Document
            {
                new StringField("Id", task.Id, Field.Store.YES),
                new TextField("Name", task.Name, Field.Store.YES),
                new StringField("NormalizedName", task.Name.ToLower(), Field.Store.YES),
                new StringField("NameNoDiacritics", RemoveDiacritics(task.Name).ToLower(), Field.Store.YES),
                new StringField("ProjectId", task.ProjectId ?? "", Field.Store.YES)
            };

            writer.AddDocument(doc);
            writer.Commit();
        }

        public async Task DeleteIndexAsync(string taskId)
        {
            var dir = FSDirectory.Open(new DirectoryInfo(_indexPath));
            var config = new IndexWriterConfig(LuceneVersion.LUCENE_48, _analyzer);
            using var writer = new IndexWriter(dir, config);

            writer.DeleteDocuments(new Term("Id", taskId));
            writer.Commit();
        }
    }
}