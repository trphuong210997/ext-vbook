load("config.js");

function execute() {
    return Response.success([
        { title: "榜单", input: "https://hetushu.com/top/index.php", script: "gen.js" }
    ]);
}
