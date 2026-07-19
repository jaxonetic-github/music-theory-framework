interface ExerciseRow {
  id: string;
  degree: number;
  label: string;
  notes: string[];
  pitchClasses: number[];

  keyboard: KeyboardModel;
  notation: NotationModel;
  playback: PlaybackModel;
}