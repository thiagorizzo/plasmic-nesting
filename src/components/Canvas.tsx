import React, { useRef, useState } from "react";
import "./Canvas.css";
import { ClientPos } from "../ui-util";
import { RawRect } from "../geom";
import _, { update } from "lodash";
import { Dict, ensure } from "../common";
import { mkid, Rect } from "../model";

interface LassoState {
  initialMouse: ClientPos;
  canvasPos: { top: number; left: number };
  lassoBbox: RawRect;
}

export interface AppState {
  rectsById: Readonly<Dict<Rect>>;
}

interface MoveState {
  initialRect: Rect;
  initialNesteds: Rect[];
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
    width: right - left,
  };
  return lassoBbox;
}

export function Canvas() {
  const [appState, setAppState] = React.useState<AppState>(
    JSON.parse(localStorage.getItem("appState") || "null") || {
      rectsById: {},
    }
  );

  const [selectedRectId, setSelectedRectId] = React.useState<
    string | undefined
  >(undefined);

  const [parentRectId, setParentRectId] = React.useState<string | undefined>(
    undefined
  );

  const [nestedRectsId, setNestedRectsIds] = React.useState<
    string[] | undefined
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
        [rect.id]: rect,
      },
    });
    setSelectedRectId(rect.id);
  }

  function addRandomRects(num: number) {
    const rects = _.range(num).map(() => ({
      id: mkid(),
      top: Math.round(Math.random() * 500),
      left: Math.round(Math.random() * 700),
      height: 100,
      width: 100,
      parentRectId: undefined,
    }));
    setAppState({
      ...appState,
      rectsById: {
        ...appState.rectsById,
        ..._.keyBy(rects, (r) => r.id),
      },
    });
    setSelectedRectId(undefined);
  }

  function deleteRects(rectIds: string[]) {
    setAppState({
      ...appState,
      rectsById: _.omit(appState.rectsById, ...rectIds),
    });
  }

  function updateRects(
    rects: Rect[],
    rect: Rect,
    deltaX: number,
    deltaY: number
  ) {
    const rectsById: Dict<Rect> = { ...appState.rectsById };
    Object.values(appState.rectsById).forEach((r) => {
      var rectToUpdate = rects.find((rect) => rect.id === r.id);
      if (rectToUpdate) {
        const rectUpdated = {
          ...rectToUpdate,
          left: rectToUpdate.left + deltaX,
          top: rectToUpdate.top + deltaY,
        };
        rectsById[r.id] = rectUpdated;
      } else if (r.id === rect.id) {
        const rectUpdated = {
          ...r,
          left: rect.left + deltaX,
          top: rect.top + deltaY,
          parentRectId: rect.parentRectId,
        };
        rectsById[r.id] = rectUpdated;
      }
    });

    setAppState({
      ...appState,
      rectsById,
    });
  }

  function getNestedRects(rect: RawRect, onlyMostTop: boolean = true) {
    let nestedIds: string[] = [];
    let nesteds: Rect[] = [];
    Object.values(appState.rectsById).forEach((r) => {
      if (
        rectIsWrapping(rect, r) &&
        (!onlyMostTop ||
          (onlyMostTop &&
            ((r.parentRectId && r.parentRectId === parentRectId) ||
              !r.parentRectId)))
      ) {
        nestedIds.push(r.id);
        nesteds.push(r);
      }
    });
    setNestedRectsIds(nestedIds);
    return nesteds;
  }

  function getChildrenRects(rect: Rect | undefined): Rect[] {
    let rectChildren: Rect[] = [];

    if (rect) {
      rectChildren = Object.values(appState.rectsById).filter((r) => {
        return r.id !== rect.id && r.parentRectId === rect.id;
      });
      rectChildren.forEach((c) => {
        var childrens1 = getChildrenRects(c);
        childrens1.forEach((c1) => {
          rectChildren.push(c1);
        });
      });
    }

    return rectChildren;
  }

  function getParentRect(
    rect: RawRect,
    rectId: string | undefined = undefined,
    withOverlapping: boolean = false
  ) {
    setParentRectId(undefined);
    let parentId = undefined;
    let currentRectParentArea: number | undefined = undefined;
    let currentRectArea = rect.width * rect.width;
    Object.values(appState.rectsById).forEach((r) => {
      if (
        ((rectId && r.id !== rectId) || !rectId) &&
        (rectIsInsideOf(rect, r) ||
          (withOverlapping && reactIsOverlapping(rect, r, 30)))
      ) {
        let elegibleParentArea = r.width * r.height;
        if (
          currentRectArea <= elegibleParentArea &&
          (!currentRectParentArea || elegibleParentArea < currentRectParentArea)
        ) {
          currentRectParentArea = elegibleParentArea;
          parentId = r.id;
          setParentRectId(parentId);
        }
      }
    });
    return parentId;
  }

  function rectToPoints(rect: RawRect) {
    return {
      x1: rect.left,
      y1: rect.top,
      x2: rect.left + rect.width,
      y2: rect.top + rect.height,
    };
  }

  function rectIsInsideOf(rect1: RawRect, rect2: RawRect) {
    const rect1points = rectToPoints(rect1);
    const rect2points = rectToPoints(rect2);

    return (
      rect2points.x1 < rect1points.x1 &&
      rect2points.y1 < rect1points.y1 &&
      rect2points.x2 > rect1points.x2 &&
      rect2points.y2 > rect1points.y2
    );
  }

  function rectIsWrapping(rect1: RawRect, rect2: RawRect) {
    const rect1points = rectToPoints(rect1);
    const rect2points = rectToPoints(rect2);

    return (
      rect2points.x1 > rect1points.x1 &&
      rect2points.y1 > rect1points.y1 &&
      rect2points.x2 < rect1points.x2 &&
      rect2points.y2 < rect1points.y2
    );
  }

  function reactIsOverlapping(
    rect1: RawRect,
    rect2: RawRect,
    percentual: number
  ) {
    var x = Math.max(rect1.left, rect2.left);
    var y = Math.max(rect1.top, rect2.top);
    var overlappingX =
      Math.min(rect1.left + rect1.width, rect2.left + rect2.width) - x;
    var overlappingY =
      Math.min(rect1.top + rect1.height, rect2.top + rect2.height) - y;

    const isOverlapping =
      overlappingX > 0 &&
      overlappingY > 0 &&
      (overlappingX >= rect1.width * (percentual / 100) ||
        overlappingY >= rect1.height * (percentual / 100));

    return isOverlapping;
  }

  function getRectBorder(id: string) {
    if (selectedRectId === id) {
      return "1px solid blue";
    } else if (parentRectId === id) {
      return "1px solid green";
    } else if (nestedRectsId && nestedRectsId.find((n) => n === id)) {
      return "1px solid red";
    }
  }

  function handleKeyDown(e: any) {
    if (e.key === "Delete" && selectedRectId) {
      deleteRects([selectedRectId]);
    }

    if (e.key === "s" && (e.metaKey || e.ctrlKey)) {
      localStorage.setItem("appState", JSON.stringify(appState));
      e.preventDefault();
    }
  }

  function handleMouseDown(e: any) {
    if (mode !== "draw") {
      let canvaPos = _.pick(
        ensure(canvasRef.current).getBoundingClientRect(),
        "top",
        "left"
      );

      let reactToSelectId = getParentRect({
        top: e.clientY - canvaPos.top,
        left: e.clientX - canvaPos.left,
        width: 0,
        height: 0,
      });
      if (reactToSelectId) {
        setSelectedRectId(reactToSelectId);

        const initialMouse = _.pick(e, "clientX", "clientY");
        const initialRect = appState.rectsById[reactToSelectId];
        const initialNesteds = getChildrenRects(initialRect);

        setMoveState({
          initialMouse,
          initialRect,
          initialNesteds,
        });
      }
      return;
    }
    e.preventDefault();

    setNestedRectsIds(undefined);
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
        height: 0,
      },
    };
    setLassoState(lassoState);
  }

  function handleMouseMove(e: any) {
    if (moveState) {
      e.preventDefault();
      const { initialMouse, initialRect, initialNesteds } = moveState;
      const deltaX = e.clientX - initialMouse.clientX;
      const deltaY = e.clientY - initialMouse.clientY;

      getParentRect(
        {
          ...initialRect,
          left: initialRect.left + deltaX,
          top: initialRect.top + deltaY,
        },
        initialRect.id,
        true
      );

      const updatedRect = {
        ...initialRect,
        left: initialRect.left,
        top: initialRect.top,
        parentRectId: parentRectId,
      };

      updateRects(initialNesteds, updatedRect, deltaX, deltaY);
    } else if (lassoState) {
      e.preventDefault();

      const lassoBbox = makeLassoRawRect(lassoState, e);

      getParentRect(lassoBbox);
      getNestedRects(lassoBbox);

      setLassoState({ ...lassoState, lassoBbox });
    }
  }

  function handleMouseUp(e: any) {
    if (moveState) {
      setMoveState(undefined);
    } else if (lassoState) {
      const rawRect = makeLassoRawRect(lassoState, e);

      const newRect = {
        id: mkid(),
        parentRectId: parentRectId,
        ...rawRect,
      };
      addRect(newRect);

      nestedRectsId?.forEach((n) => {
        const nested = Object.values(appState.rectsById).find(
          (r) => r.id === n
        );
        if (nested) {
          nested.parentRectId = newRect.id;
        }
      });

      setSelectedRectId(undefined);
      setLassoState(undefined);
    }

    setParentRectId(undefined);
    setNestedRectsIds(undefined);
  }

  return (
    <div>
      Mode:{" "}
      <select value={mode} onChange={(e) => setMode(e.target.value)}>
        <option value={"select"}>Select</option>
        <option value={"draw"}>Draw</option>
      </select>
      <RectAdder onAdd={addRandomRects} />
      <div
        className="Canvas"
        ref={canvasRef}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {Object.values(appState.rectsById).map((rect) => {
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
                border: getRectBorder(rect.id),
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                if (mode !== "select") {
                  return;
                }
                setSelectedRectId(rect.id);
                const initialMouse = _.pick(e, "clientX", "clientY");
                const initialRect = appState.rectsById[rect.id];

                const initialNesteds = getChildrenRects(rect);

                setMoveState({
                  initialMouse,
                  initialRect,
                  initialNesteds,
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
        onChange={(e) => setCount(e.currentTarget.value)}
      />
      <button onClick={() => props.onAdd(parseInt(count) || 1)}>
        Add random rectangles
      </button>
    </div>
  );
}
