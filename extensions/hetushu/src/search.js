load("config.js");

function execute(key, page) {
    if (!page) page = "1";

    var searchUrl = BASE_URL + "/book/search.php?keyword=" + encodeURIComponent(key) + "&page=" + page;
    var doc = hetuGetDoc(searchUrl);
    if (!doc || hetuIsChallenge(doc)) {
        return Response.error("Search failed: " + hetuDebugDoc(doc));
    }

    var data = [];
    var seen = {};

    doc.select(".list dd, .search-list dd, .book-list dd").forEach(function (el) {
        var linkEl = el.select("h4 a, a").first();
        var imgEl = el.select("img").first();
        if (!linkEl) return;

        var link = (linkEl.attr("href") || "") + "";
        if (!link || seen[link]) return;
        seen[link] = true;
        link = hetuAbsUrl(link);
        if (!link.endsWith("index.html") && link.match(/\/book\/\d+/)) {
            link = link.replace(/\/?$/, "/index.html");
        }

        var cover = "";
        if (imgEl) {
            cover = (imgEl.attr("data-src") || imgEl.attr("src") || "") + "";
            cover = hetuAbsUrl(cover);
        }

        data.push({
            name: (linkEl.text() || "").trim() + "",
            link: link,
            cover: cover,
            description: (el.select(".intro").text() || "") + "",
            host: BASE_URL
        });
    });

    var hasNext = doc.select(".next a, a.next, .pagination .next").size() > 0;
    return Response.success(data, hasNext ? String(parseInt(page) + 1) : null);
}
