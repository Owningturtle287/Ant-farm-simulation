# Open Little Colony on iPhone

**[Play Little Colony](https://owningturtle287.github.io/Ant-farm-simulation/)**

1. Open the link in **Safari** on your iPhone.
2. Tap **Share → Add to Home Screen**.
3. If shown, turn on **Open as Web App**.
4. Tap **Add**, then open the **Little Colony** icon.

A regular Safari bookmark also works. The Home Screen icon gives you the standalone app experience.

## Offline and saves

The first online visit caches the game files. The More menu shows **Ready for offline play** when this finishes. After that, the Home Screen app can reopen without a connection.

The colony saves every 20 seconds and when the page is hidden or closed. It rests while closed. Saves belong to this browser/device; clearing website data removes them. **More → Export colony backup** keeps an extra JSON copy.

A corrupt primary save is recovered from its valid backup. If both copies are unreadable, automatic overwriting is blocked until an explicit save or confirmed new colony.

## The link in GitHub Actions

Open the **[Deploy Little Colony workflow](https://github.com/Owningturtle287/Ant-farm-simulation/actions/workflows/pages.yml)** and its latest successful run. Its **deploy** job shows the live GitHub Pages address. The run summary also contains **Open Little Colony**.

Save the live address to your phone. It stays the same when new versions deploy.

## Controls

Drag to explore; pinch or scroll to zoom. Tap an ant for its profile; repeated taps cycle through overlapping ants. Choose Food or Water, then tap to place a source on the surface. Trails shows scent signals; Nest returns home; Colony opens the roster. Pause and the speed button control the pace through **1×, 2×, 4×, 8×, 16×, 32×, 64×, and 128×**.

**More → Colony & reproduction** sets egg laying, brood development, the next colony’s starting worker count, and the population ceiling. Turning laying off does not stop existing brood from developing. A lower ceiling never removes existing ants. New colonies default to 12 workers and one queen; updates preserve existing colonies.

**More → Show performance** displays FPS, simulation/drawing cost, actual versus requested speed, and population. Export readings for later device testing. Higher populations may achieve less than the requested time lapse; the app prioritizes usable controls. **More → Terrain guide** explains material textures.

More also contains saving, Home Screen instructions, help, and a confirmed new-colony action.

Portrait and landscape both work. Turning your phone sideways gives a wider cutaway view.

## Rain & renewal update

Refresh or reopen online to load v0.5. New colonies generate rolling ground and unique uneven mounds; existing colonies keep their established terrain. Use **More → Start a new colony** only when you want to replace your current colony. Export a backup first if you want to retain a copy.

Grain appears on grass heads. Harvested clumps wither, then regrow after a delay. Rain falls intermittently and fills low spots; puddles shrink as ants drink and water evaporates. All earth is diggable, with no rock barriers. White eggs, pale segmented larvae, and tan pupae have distinct sprites. Nurses carry new eggs from the queen to the nursery. Open **Colony** for stage counts, brood deliveries, and the queen’s current laying target.

## Fire ant society update

**More → Fire ant behavior** explains the single-queen species model. Large workers are general workers with size/age tendencies, not permanent guards. Open **Colony** to see what is supporting or limiting growth. Brood develops over modeled weeks; a low founder population before the first generation emerges is not itself a deadlock.

Food placement now supplies finite insect pieces and nectar. Water squares vanish as ants collect portions. Natural rain and plants add new stock; later insect arrivals are distinct resources. **Trails** shows the chemical cue legend. At **1×**, use **More → Disturb the ground**, then tap close to workers to watch a temporary alarm. Tapping empty ground produces no worker alarm.

Updates preserve existing progress. Start a new colony only when you want the revised narrow peripheral founder entrance. Existing workers adopt the new behavior in place, including release from old patrol loops.


Population ceilings now range from 20 to 10,000 under More → Colony & reproduction; the default stays 120. High ceilings are experimental. Large colonies save in the browser's database with a previous complete generation as backup. Keep the same browser/Home Screen origin, and export a backup before clearing site data. Actual speed in More → Show performance records what the device sustains.
