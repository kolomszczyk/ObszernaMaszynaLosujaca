(() => {
  const holder = document.querySelector(".bubbles");
  if (!holder) return;

  const COUNT = 120; // ilość bąbelków (zmień np. 80–180)
  const vw = () => Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
  const vh = () => Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);

  function rand(min, max){ return Math.random() * (max - min) + min; }

  function spawn(){
    holder.innerHTML = "";
    for (let i = 0; i < COUNT; i++){
      const b = document.createElement("span");
      b.className = "bubble";

      // raczej małe rozmiary (prawdziwe piwo)
      const size = rand(3, 10);                 // px
      const left = rand(0, 100);                // %
      const dur = rand(3.5, 10);                // s
      const delay = rand(0, 10);                // s
      const travel = rand(vh() * 0.7, vh() * 1.15); // jak wysoko poleci
      const drift = rand(-18, 18);              // lekkie odchylenie na boki (px)

      b.style.setProperty("--size", `${size}px`);
      b.style.setProperty("--left", `${left}%`);
      b.style.setProperty("--dur", `${dur}s`);
      b.style.setProperty("--delay", `${-delay}s`); // ujemne = start od razu „w trakcie”
      b.style.setProperty("--travel", `${travel}px`);
      b.style.setProperty("--drift", `${drift}px`);

      holder.appendChild(b);
    }
  }

  spawn();
  window.addEventListener("resize", () => {
    // po resize przelicz wysokości lotu
    spawn();
  });
})();
