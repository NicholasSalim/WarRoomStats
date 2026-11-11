import { expect, test, type Page } from "@playwright/test";

// One smoke test per page, against fixture data (see src/lib/coc/fixtures.ts
// for the reserved tags that simulate error states).

const CLAN = "2PRGP0L22";
const PLAYER = "2PP";
const FOOTER = /not endorsed by Supercell/;

async function expectNoHorizontalScroll(page: Page) {
  const [scroll, client] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    document.documentElement.clientWidth,
  ]);
  expect(scroll).toBeLessThanOrEqual(client);
}

test("home: search panel, footer notice and player search", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(FOOTER)).toBeVisible();
  // Top 20 players and clans, with links to the full leaderboards.
  await expect(page.getByRole("heading", { name: "Top players" })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(40);
  await expect(page.getByRole("link", { name: "Top clans" })).toHaveAttribute("href", /kind=clans/);

  await page.getByRole("tab", { name: "Find a player" }).click();
  await page.getByLabel("Player tag").fill(`#${PLAYER.toLowerCase()}`);
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(new RegExp(`/player/${PLAYER}$`));
  await expectNoHorizontalScroll(page);
});

test("clan search: results link to clans and are remembered", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Clan name").fill("night");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/\/search\?name=night/);
  await expect(page.getByText(/clans named/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Night Owls/ }).first()).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Recent" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Clans named/ })).toBeVisible();
});

test("clan: overview with members, war log and raids tabs", async ({ page }) => {
  await page.goto(`/clan/${CLAN}`);
  await expect(page.getByRole("heading", { level: 1, name: "Night Owls" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Members" })).toBeVisible();
  await expect(page.locator("#members tbody tr")).toHaveCount(30);
  await expect(page.getByText(FOOTER)).toBeVisible();

  // Sorting by trophies puts the highest first.
  await page.getByRole("button", { name: "Trophies" }).click();
  const first = await page.locator("#members tbody tr").first().locator("td").nth(4).innerText();
  expect(first.replace(/,/g, "")).toMatch(/^\d+$/);
  await expectNoHorizontalScroll(page);

  const tabs = page.getByRole("navigation", { name: "Clan sections" });
  await tabs.getByRole("link", { name: "War log" }).click();
  await expect(page).toHaveURL(new RegExp(`/clan/${CLAN}/warlog$`));
  await expect(page.getByRole("heading", { name: "War log" })).toBeVisible();
  await tabs.getByRole("link", { name: "Raids" }).click();
  await expect(page).toHaveURL(new RegExp(`/clan/${CLAN}/raids$`));
  await expect(page.getByRole("heading", { name: "Raid weekends" })).toBeVisible();
  await expect(tabs.getByRole("link", { name: "Raids" })).toHaveAttribute("aria-current", "page");
});

test("current war: scoreboard and both line-ups", async ({ page }) => {
  await page.goto(`/clan/${CLAN}/war`);
  await expect(page.getByText("Battle day")).toBeVisible();
  await expect(page.getByRole("region", { name: /line-up/ })).toHaveCount(2);
  await expect(page.getByText(/Ends in/)).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test("CWL: standings, rounds and player stats", async ({ page }) => {
  await page.goto(`/clan/${CLAN}/cwl`);
  await expect(page.getByRole("heading", { name: /November 2026 season/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Group standings" })).toBeVisible();
  await expect(page.getByText("Not started")).toHaveCount(4);
  await page.getByRole("link", { name: /Round 1/ }).click();
  // The URL changes once the round's page has fully loaded. On `next dev`,
  // with tests running in parallel, that took 6 to 13 s locally and over 30 s
  // once on CI (the live site: about 1 s).
  await expect(page).toHaveURL(/round=1/, { timeout: 90_000 });
  await expect(page.getByRole("heading", { name: "Round 1" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Player stats" })).toBeVisible();
});

test("player: tabs for overview, progress and achievements", async ({ page }) => {
  await page.goto("/player/9YCQ2L0P");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const tabs = page.getByRole("navigation", { name: "Player sections" });
  await expect(tabs.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();

  await tabs.getByRole("link", { name: "Progress" }).click();
  await expect(page).toHaveURL(/\/player\/9YCQ2L0P\/progress$/);
  await expect(page.getByRole("heading", { name: "Heroes", exact: true })).toBeVisible();
  await expect(page.getByRole("meter", { name: "Barbarian King level" })).toBeVisible();

  await tabs.getByRole("link", { name: "Achievements" }).click();
  await expect(page.getByRole("heading", { name: "Achievements" })).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test("player: ranked tab and battle log tab", async ({ page }) => {
  await page.goto("/player/9YCQ2L0P/ranked");
  const ranked = page.locator("#ranked");
  await expect(ranked.getByRole("heading", { name: "Ranked league" })).toBeVisible();
  await expect(ranked.getByText("Group rank")).toBeVisible();
  // Fixture player is a weekly tier (Titan): its weekly allowance and a link to the season page.
  await expect(ranked.getByText("Attacks allowed")).toBeVisible();
  await expect(ranked.getByRole("link", { name: "Season details" })).toBeVisible();
  await expect(ranked.getByRole("heading", { name: "Past seasons" })).toBeVisible();

  await page.getByRole("navigation", { name: "Player sections" }).getByRole("link", { name: "Battle log" }).click();
  await expect(page).toHaveURL(/\/battles$/);
  const log = page.locator("#battle-log");
  await expect(log.getByRole("heading", { name: "Battle log" })).toBeVisible();
  const rows = log.locator("ul > li > button[aria-expanded]");

  // Ranked and Regular battles are on separate tabs; Ranked is the default.
  const rankedTab = log.getByRole("tab", { name: /^Ranked/ });
  const regularTab = log.getByRole("tab", { name: /^Regular/ });
  await expect(rankedTab).toHaveAttribute("aria-selected", "true");
  const rankedCount = await rows.count();
  await regularTab.click();
  const regularCount = await rows.count();
  expect(rankedCount + regularCount).toBe(40);

  // Attacks + defenses add up within a tab.
  await rankedTab.click();
  await log.getByRole("button", { name: "attacks", exact: true }).click();
  const attacks = await rows.count();
  await log.getByRole("button", { name: "defenses", exact: true }).click();
  const defenses = await rows.count();
  expect(attacks + defenses).toBe(rankedCount);

  // A row expands to show loot and the army, and collapses again.
  await log.getByRole("button", { name: "all", exact: true }).click();
  const first = rows.first();
  await first.click();
  await expect(first).toHaveAttribute("aria-expanded", "true");
  await expect(log.getByText(/^Army used/).first()).toBeVisible();
  await expect(log.getByRole("link", { name: /Open army in game/ })).toHaveAttribute("href", /action=CopyArmy&army=/);
  await first.click();
  await expect(first).toHaveAttribute("aria-expanded", "false");
});

test("player without a ranked group", async ({ page }) => {
  await page.goto("/player/28PP/ranked");
  await expect(page.locator("#ranked").getByRole("heading", { name: "Ranked league" })).toBeVisible();
  await page.goto("/player/28PP/battles");
  await expect(page.locator("#battle-log").getByRole("heading", { name: "Battle log" })).toBeVisible();
});

test("leaderboards: players, clans and location", async ({ page }) => {
  await page.goto("/leaderboards");
  await expect(page.getByRole("heading", { name: "Leaderboards" })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(50);
  await page.getByRole("link", { name: "Clans" }).click();
  await expect(page).toHaveURL(/kind=clans/);
  await page.getByLabel("Location").selectOption({ label: "Germany" });
  await expect(page).toHaveURL(/location=32000094/);
  await expect(page.locator("tbody tr")).toHaveCount(50);
});

test("leaderboards: past Legend I seasons are paginated", async ({ page }) => {
  await page.goto("/leaderboards");
  await page.getByRole("link", { name: "Past Seasons" }).click();
  await expect(page).toHaveURL(/scope=legend/);
  await expect(page.getByLabel("Season")).toHaveValue("v2-2026-10-26T05:00:00Z");
  await expect(page.locator("tbody tr")).toHaveCount(100);
  await page.getByRole("link", { name: "Next page" }).first().click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator("tbody tr").first()).toContainText("101");
  // The mock season has 250 players: page 3 is the last.
  // Numbered like the other pagers, with a trailing gap while more pages exist.
  await expect(page.getByRole("link", { name: "3", exact: true }).first()).toBeVisible();
  await page.getByRole("spinbutton", { name: "Go to page" }).first().fill("3");
  await page.getByRole("button", { name: "Go to page" }).first().click();
  await expect(page.locator("tbody tr")).toHaveCount(50);
  await expect(page.getByRole("link", { name: "Next page" })).toHaveCount(0);
  await expectNoHorizontalScroll(page);
});

test.describe("error states", () => {
  const cases = [
    ["/clan/888PP", "notFound"],
    ["/player/888PP", "notFound"],
    ["/player/ABC", "invalidTag"],
    ["/clan/99922", "maintenance"],
    ["/clan/22PP/war", "privateWarLog"],
    ["/clan/28PP/war", "notInWar"],
    ["/clan/28PP/cwl", "cwlNotActive"],
    ["/rate-limited", "rateLimited"],
  ] as const;
  for (const [path, kind] of cases) {
    test(`${path} shows ${kind}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator(`[data-error-kind="${kind}"]`)).toBeVisible();
      await expect(page.locator("[data-error-kind]")).toHaveCount(1);
    });
  }

  test("unknown route is a 404", async ({ page }) => {
    const res = await page.goto("/definitely-not-here");
    expect(res?.status()).toBe(404);
  });
});

test("player season: day-by-day page linked from the ranked section", async ({ page }) => {
  await page.goto("/player/9YCQ2L0P/ranked");
  await page.locator("#ranked").getByRole("link", { name: "Details", exact: true }).click();
  await expect(page).toHaveURL(/\/player\/9YCQ2L0P\/season$/);
  await expect(page.getByRole("heading", { level: 2, name: /season$/ })).toBeVisible();
  // The season page counts as the Ranked tab.
  await expect(
    page.getByRole("navigation", { name: "Player sections" }).getByRole("link", { name: "Ranked" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Season so far" })).toBeVisible();
  // Fixture player is a weekly tier: the week's days, newest first, starting from day 1.
  await expect(page.getByRole("heading", { name: "Days" })).toBeVisible();
  await expect(page.getByText("Day 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back" })).toBeVisible();
});

test("leaderboards: Builder Base and Clan Capital boards", async ({ page }) => {
  await page.goto("/leaderboards?kind=clans");
  await page.getByRole("link", { name: "Clan Capital" }).click();
  await expect(page).toHaveURL(/scope=capital/);
  await expect(page.getByRole("columnheader", { name: "Capital trophies" })).toBeVisible();
  await page.getByRole("link", { name: "Players", exact: true }).click();
  await expect(page).toHaveURL(/kind=players/);
  await page.getByRole("link", { name: "Builder Base" }).click();
  await expect(page).toHaveURL(/kind=players.*scope=builder/);
  await expect(page.getByRole("columnheader", { name: "Builder Base" })).toBeVisible();
});

test("clan search by label only", async ({ page }) => {
  await page.goto("/search?labelIds=56000000");
  await expect(page.getByText(/labelled Clan Wars/)).toBeVisible();
});

test("clan raid weekend details and capital districts", async ({ page }) => {
  await page.goto(`/clan/${CLAN}/raids`);
  await expect(page.getByRole("heading", { name: /^Weekend of / })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Raiders \(\d+\)$/ }).first()).toBeVisible();
  await expect(page.getByText("Raid Target").first()).toBeVisible();
  await page.goto(`/clan/${CLAN}`);
  await expect(page.getByText(/Season ends/)).toBeVisible();
});

test("clan search bar takes a name or a tag", async ({ page }) => {
  await page.goto("/search?name=night");
  const bar = page.getByRole("search").getByLabel("Clan name or tag");
  await expect(bar).toHaveValue("night");
  await bar.fill(`#${CLAN}`);
  await bar.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/clan/${CLAN}$`));
});

test("player search: tag without #, and invalid or unknown tags", async ({ page }) => {
  await page.goto(`/search/players?name=${PLAYER.toLowerCase()}`);
  await expect(page).toHaveURL(new RegExp(`/player/${PLAYER}$`));
  await page.goto("/search/players?name=not%20a%20tag");
  await expect(page.getByText(/Tags only use/)).toBeVisible();
  await page.goto("/search/players?name=%23888PP");
  await expect(page.getByText(/No player has the tag #888PP/)).toBeVisible();
});

test("player: wars and raids tabs", async ({ page }) => {
  await page.goto("/player/9YCQ2L0P/wars");
  await expect(page.getByRole("heading", { name: "Current war" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Clan War League" })).toBeVisible();
  await expect(page.getByText(/attacks and defenses in .+'s current war and this Clan War League season/)).toBeVisible();

  await page.getByRole("navigation", { name: "Player sections" }).getByRole("link", { name: "Raids" }).click();
  await expect(page).toHaveURL(/\/raids$/);
  await expect(page.getByRole("heading", { name: "Raid weekends" })).toBeVisible();
  await expect(page.getByText(/Earlier weekends are on/)).toBeVisible();
});

test("impossible tags get a real 404", async ({ page }) => {
  for (const path of ["/clan/notatag", "/player/hello!/battles"]) {
    const res = await page.goto(path);
    expect(res?.status()).toBe(404);
    await expect(page.getByText(/That tag doesn.t look right/)).toBeVisible();
  }
  // Well-formed tags still render (unknown ones show "not found" in the page).
  const ok = await page.goto(`/clan/${CLAN}`);
  expect(ok?.status()).toBe(200);
});
