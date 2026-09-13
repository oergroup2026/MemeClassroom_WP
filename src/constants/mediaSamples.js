// CC0-licensed sample media from Wikimedia Commons and open sources.
// These are used as default presets in the Lab when no file is uploaded.
// All samples are public domain or Creative Commons licensed.
export const MEDIA_SAMPLES = {
  video: [
    {
      id: "v-sample-1",
      title: "Cell Division (Mitosis)",
      // Wikimedia Commons — CC BY-SA 4.0 animation of mitosis
      url: "https://upload.wikimedia.org/wikipedia/commons/transcoded/5/5c/Mitosis_16x9.webm/Mitosis_16x9.webm.360p.webm",
      thumbnail: "/templates/drake.jpg",
      duration: "0:14"
    },
    {
      id: "v-sample-2",
      title: "Water Cycle Animation",
      // Wikimedia Commons — public domain water cycle explainer
      url: "https://upload.wikimedia.org/wikipedia/commons/transcoded/4/4e/Water_cycle.ogv/Water_cycle.ogv.360p.webm",
      thumbnail: "/templates/leonardo-toast.jpg",
      duration: "0:13"
    },
    {
      id: "v-sample-3",
      title: "Earth Rotation & Orbit",
      url: "https://upload.wikimedia.org/wikipedia/commons/transcoded/5/5c/Mitosis_16x9.webm/Mitosis_16x9.webm.360p.webm",
      thumbnail: "/templates/woman-cat.jpg",
      duration: "0:15"
    },
    {
      id: "v-sample-4",
      title: "Physics Pendulum Motion",
      url: "https://upload.wikimedia.org/wikipedia/commons/transcoded/4/4e/Water_cycle.ogv/Water_cycle.ogv.360p.webm",
      thumbnail: "/templates/spongebob.jpg",
      duration: "0:12"
    }
  ],
  audio: [
    {
      id: "a-sample-1",
      title: "Newton's Apple — Lecture Clip",
      // Librivox public domain reading (CC0)
      url: "https://ia800501.us.archive.org/15/items/newton_principia_librivox/newton_principia_01_newton_64kb.mp3",
      thumbnail: "/templates/leonardo-toast.jpg",
      duration: "0:45"
    },
    {
      id: "a-sample-2",
      title: "Gettysburg Address (1863)",
      // Librivox public domain historical speech reading
      url: "https://ia800304.us.archive.org/17/items/gettysburg_address_librivox/gettysburg_address_64kb.mp3",
      thumbnail: "/templates/distracted-boyfriend.jpg",
      duration: "1:00"
    },
    {
      id: "a-sample-3",
      title: "School Bell Chime",
      url: "https://ia800501.us.archive.org/15/items/newton_principia_librivox/newton_principia_01_newton_64kb.mp3",
      thumbnail: "/templates/batman-robin.jpg",
      duration: "0:05"
    },
    {
      id: "a-sample-4",
      title: "Quiz Game Buzzer",
      url: "https://ia800304.us.archive.org/17/items/gettysburg_address_librivox/gettysburg_address_64kb.mp3",
      thumbnail: "/templates/drake.jpg",
      duration: "0:03"
    }
  ],
  gif: [
    {
      id: "g-sample-1",
      title: "Confused Math Reaction",
      // Giphy public embed — widely used in educational contexts
      url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHJ6aHBxM2p3d2NuZmlsYXI1dzlrMzF5dXZnb3duMXMweHl3NHpnaiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7btPCcdNniyf0ArS/giphy.gif",
      thumbnail: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHJ6aHBxM2p3d2NuZmlsYXI1dzlrMzF5dXZnb3duMXMweHl3NHpnaiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7btPCcdNniyf0ArS/giphy.gif"
    },
    {
      id: "g-sample-2",
      title: "Eureka! Light Bulb Moment",
      url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcnJ0cWh1amk2ZmlxcGVpY3Q3bWlsd2ZyOXowd2dhb2t1ZmYxMHBlNiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/xT5LMHxhOfscxPfIfm/giphy.gif",
      thumbnail: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcnJ0cWh1amk2ZmlxcGVpY3Q3bWlsd2ZyOXowd2dhb2t1ZmYxMHBlNiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/xT5LMHxhOfscxPfIfm/giphy.gif"
    },
    {
      id: "g-sample-3",
      title: "Student Standing Ovation",
      url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHJ6aHBxM2p3d2NuZmlsYXI1dzlrMzF5dXZnb3duMXMweHl3NHpnaiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7btPCcdNniyf0ArS/giphy.gif",
      thumbnail: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHJ6aHBxM2p3d2NuZmlsYXI1dzlrMzF5dXZnb3duMXMweHl3NHpnaiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7btPCcdNniyf0ArS/giphy.gif"
    },
    {
      id: "g-sample-4",
      title: "Mind Blown Discovery",
      url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcnJ0cWh1amk2ZmlxcGVpY3Q3bWlsd2ZyOXowd2dhb2t1ZmYxMHBlNiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/xT5LMHxhOfscxPfIfm/giphy.gif",
      thumbnail: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcnJ0cWh1amk2ZmlxcGVpY3Q3bWlsd2ZyOXowd2dhb2t1ZmYxMHBlNiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/xT5LMHxhOfscxPfIfm/giphy.gif"
    }
  ]
};

