export function run(main: () => Promise<void>) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
