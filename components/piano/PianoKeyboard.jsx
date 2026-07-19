import {
  NOTE_NAMES,
  WHITE_NOTES,
  BLACK_NOTES,
} from "../../theory/notes";

const WHITE_WIDTH = 60;
const WHITE_HEIGHT = 260;

const BLACK_WIDTH = 38;
const BLACK_HEIGHT = 160;

export default function PianoKeyboard({
  octaves,
  highlightedNotes,
}) {
  const isHighlighted =
    (noteName) =>
      highlightedNotes.includes(
        noteName
      );

  return (
    <div className="overflow-x-auto">
      <div className="flex">
        {Array.from({
          length: octaves,
        }).map((_, octave) => (
          <div
            key={octave}
            className="relative"
            style={{
              width:
                WHITE_WIDTH * 7,
              height:
                WHITE_HEIGHT,
            }}
          >
            <div className="flex">
              {WHITE_NOTES.map(
                note => (
                  <div
                    key={note}
                    className={`
                      border border-black
                      flex items-end
                      justify-center

                      ${
                        isHighlighted(
                          note
                        )
                          ? "bg-green-300"
                          : "bg-white"
                      }
                    `}
                    style={{
                      width:
                        WHITE_WIDTH,
                      height:
                        WHITE_HEIGHT,
                    }}
                  >
                    {note}
                  </div>
                )
              )}
            </div>

            {BLACK_NOTES.map(
              black => (
                <div
                  key={black.note}
                  className={`
                    absolute
                    top-0
                    rounded-b
                    text-white
                    flex items-end
                    justify-center

                    ${
                      isHighlighted(
                        black.note
                      )
                        ? "bg-green-600"
                        : "bg-black"
                    }
                  `}
                  style={{
                    left:
                      black.whitePosition *
                        WHITE_WIDTH -
                      BLACK_WIDTH /
                        2,
                    width:
                      BLACK_WIDTH,
                    height:
                      BLACK_HEIGHT,
                  }}
                >
                  {
                    black.note
                  }
                </div>
              )
            )}
          </div>
        ))}
      </div>
    </div>
  );
}