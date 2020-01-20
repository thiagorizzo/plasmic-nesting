import React, { useRef, useState } from "react";
import "./Canvas.css";
import { ClientPos } from "../ui-util";
import { RawRect } from "../geom";
import _ from "lodash";
import { Dict, ensure } from "../common";
import { mkid, Rect } from "../model";

interface LassoState {
  initialMouse: ClientPos;
  canvasPos: { top: number; left: number };
  lassoBbox: RawRect;
}

export interface AppState {
  readonly rectsById: Readonly<Dict<Rect>>;
}

interface MoveState {
  initialRect: Rect;
  initialMouse: ClientPos;
}

function makeLassoRawRect(_lasso: LassoState, e: React.MouseEvent) {
  const left = Math.min(_lasso.initialMouse.clientX, e.clientX),
    top = Math.min(_lasso.initialMouse.clientY, e.clientY),
    right = Math.max(_lasso.initialMouse.clientX, e.clientX),
    bottom = Math.max(_lasso.initialMouse.clientY, e.clientY);

  const lassoBbox: RawRect = {
    top: top - _lasso.canvasPos.top,
    left: left - _lasso.canvasPos.left,
    height: bottom - top,
    width: right - left
  };
  return lassoBbox;
}

export function Canvas() {
  const [appState, setAppState] = React.useState<AppState>(
    JSON.parse(localStorage.getItem("appState") || "null") || {
      rectsById: {}
    }
  );

  const [selectedRectId, setSelectedRectId] = React.useState<
    string | undefined
  >(undefined);

  const [lassoState, setLassoState] = React.useState<LassoState | undefined>(
    undefined
  );

  const [moveState, setMoveState] = React.useState<MoveState | undefined>(
    undefined
  );

  const [mode, setMode] = useState("select");

  const canvasRef = useRef<HTMLDivElement>(null);

  function addRect(rect: Rect) {
    setAppState({
      ...appState,
      rectsById: {
        ...appState.rectsById,
        [rect.id]: rect
      }
    });
    setSelectedRectId(rect.id);
  }
  function addRandomRects(num: number) {
    const rects = _.range(num).map(() => ({
      id: mkid(),
      top: Math.round(Math.random() * 500),
      left: Math.round(Math.random() * 700),
      height: 100,
      width: 100
    }));
    setAppState({
      ...appState,
      rectsById: {
        ...appState.rectsById,
        ..._.keyBy(rects, r => r.id)
      }
    });
    setSelectedRectId(undefined);
  }
  function deleteRects(rectIds: string[]) {
    setAppState({
      ...appState,
      rectsById: _.omit(appState.rectsById, ...rectIds)
    });
  }
  function updateRect(rect: Rect) {
    setAppState({
      ...appState,
      rectsById: {
        ...appState.rectsById,
        [rect.id]: rect
      }
    });
  }

  return (
    <div>
      Mode:{" "}
      <select value={mode} onChange={e => setMode(e.target.value)}>
        <option value={"select"}>Select</option>
        <option value={"draw"}>Draw</option>
      </select>
      <RectAdder onAdd={addRandomRects} />
      <div
        className="Canvas"
        ref={canvasRef}
        tabIndex={-1}
        onKeyDown={e => {
          if (e.key === "Delete" && selectedRectId) {
            deleteRects([selectedRectId]);
          }
          if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
            localStorage.setItem("appState", JSON.stringify(appState));
            e.preventDefault();
          }
        }}
        onMouseDown={e => {
          if (mode !== "draw") {
            return;
          }
          e.preventDefault();
          setSelectedRectId(undefined);
          const lassoState: LassoState = {
            initialMouse: _.pick(e, "clientX", "clientY"),
            canvasPos: _.pick(
              ensure(canvasRef.current).getBoundingClientRect(),
              "top",
              "left"
            ),
            lassoBbox: {
              left: 0,
              top: 0,
              width: 0,
              height: 0
            }
          };
          setLassoState(lassoState);
        }}
        onMouseMove={e => {
          if (moveState) {
            e.preventDefault();
            const { initialMouse, initialRect } = moveState;
            const deltaX = e.clientX - initialMouse.clientX;
            const deltaY = e.clientY - initialMouse.clientY;
            updateRect({
              ...initialRect,
              left: initialRect.left + deltaX,
              top: initialRect.top + deltaY
            });
          } else if (lassoState) {
            e.preventDefault();
            const lassoBbox = makeLassoRawRect(lassoState, e);
            setLassoState({ ...lassoState, lassoBbox });
          }
        }}
        onMouseUp={e => {
          if (moveState) {
            setMoveState(undefined);
          } else if (lassoState) {
            const rawRect = makeLassoRawRect(lassoState, e);
            setLassoState(undefined);
            addRect({ id: mkid(), ...rawRect });
          }
        }}
      >
        {Object.values(appState.rectsById).map(rect => {
          const { left, top, height, width } = rect;

          return (
            <div
              key={rect.id}
              className={"RectView"}
              style={{
                left,
                top,
                height,
                width,
                border:
                  selectedRectId === rect.id ? "1px solid blue" : undefined
              }}
              onMouseDown={e => {
                e.preventDefault();
                if (mode !== "select") {
                  return;
                }
                setSelectedRectId(rect.id);
                const initialMouse = _.pick(e, "clientX", "clientY");
                const initialRect = appState.rectsById[rect.id];
                setMoveState({
                  initialMouse,
                  initialRect
                });
              }}
            />
          );
        })}
        {lassoState && (
          <>
            <div className={"LassoView"} style={{ ...lassoState.lassoBbox }} />
          </>
        )}
      </div>
    </div>
  );
}

function RectAdder(props: { onAdd: (num: number) => void }) {
  const [count, setCount] = React.useState("10");

  return (
    <div className="adder">
      <input
        type="text"
        value={count}
        onChange={e => setCount(e.currentTarget.value)}
      />
      <button onClick={() => props.onAdd(parseInt(count) || 1)}>
        Add random rectangles
      </button>
    </div>
  );
}
