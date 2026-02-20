import { useState, useRef, useCallback, useEffect } from "react";
import characterImg from "@/assets/images/character-penguin.png";
import duriImg from "@/assets/images/duri.png";
import ggatworiImg from "@/assets/images/ggatwori.png";
import momtworiImg from "@/assets/images/momtwori.png";
import kongsooneImg from "@/assets/images/kongsoone.png";
import pobyImg from "@/assets/images/poby.png";
import pinkfongImg from "@/assets/images/1.pinkfong_3D.png";
import daddy_sharkImg from "@/assets/images/daddy_shark.png";
import krongImg from "@/assets/images/krong.png";
import pepepinImg from "@/assets/images/pepepin.png";


import Celebration from "./Celebration";
import { playSnapSound, playSuccessSound, playCelebrationSound, playPickupSound } from "@/utils/sounds";

const SNAP_THRESHOLD = 120;
const IMAGE_WIDTH = 250;
const ASPECT_RATIO = 1.9;
const IMAGE_HEIGHT = IMAGE_WIDTH * ASPECT_RATIO;

const CHARACTERS = [
  { img: characterImg, name: "뽀로로" },
  { img: duriImg, name: "까투리친구" },
  { img: ggatworiImg, name: "까투리" },
  { img: momtworiImg, name: "엄마까투리" },
  { img: kongsooneImg, name: "콩순이" },
  { img: pobyImg, name: "포비" },
  { img: pinkfongImg, name: "핑크퐁" },
  { img: daddy_sharkImg, name: "아빠상어" },
  { img: krongImg, name: "크롱" },
  { img: pepepinImg, name: "베베핀" },
];

interface PieceState {
  x: number;
  y: number;
  snapped: boolean;
}

export default function PuzzleGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageIndex, setStageIndex] = useState(0);
  const [pieces, setPieces] = useState<{ top: PieceState; bottom: PieceState }>(() => ({
    top: { x: 0, y: 0, snapped: false },
    bottom: { x: 0, y: 0, snapped: false },
  }));
  const [dragging, setDragging] = useState<"top" | "bottom" | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [completed, setCompleted] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [showNextStagePopup, setShowNextStagePopup] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [initialized, setInitialized] = useState(false);

  const currentChar = CHARACTERS[stageIndex];

  const getTargetPos = useCallback(() => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: rect.width * 0.25 - IMAGE_WIDTH / 2,
      y: rect.height / 2 - IMAGE_HEIGHT / 2,
    };
  }, []);

  /** 오른쪽 영역에 겹치지 않게 조각 위치 생성 (가운데 배치, 위/아래 랜덤) */
  const getRandomPiecePositions = useCallback(
    (avoidPiece?: { x: number; y: number; snapped: boolean } | null): { top: PieceState; bottom: PieceState } => {
      if (!containerRef.current) return { top: { x: 0, y: 0, snapped: false }, bottom: { x: 0, y: 0, snapped: false } };
      const rect = containerRef.current.getBoundingClientRect();
      const PIECE_H = IMAGE_HEIGHT / 2;
      const GAP = 24;
      const EDGE_MARGIN = 50;

      // 오른쪽 영역 내에서 가장자리 50px 여백 (구분선+50px ~ 오른쪽끝-50px)
      const areaRight = rect.width - EDGE_MARGIN - IMAGE_WIDTH;
      const areaLeft = Math.min(rect.width / 2 + EDGE_MARGIN, areaRight - 20);
      const areaWidth = Math.max(IMAGE_WIDTH * 0.15, areaRight - areaLeft);

      // 상/하 구역 (가장자리로부터 50px)
      const areaTop = EDGE_MARGIN;
      const areaBottom = rect.height - EDGE_MARGIN - PIECE_H;
      const totalHeight = areaBottom - areaTop;

      // 최소 2*PIECE_H + GAP 이상 필요. 부족하면 고정 배치
      const minHeight = 2 * PIECE_H + GAP;
      let upperZoneMinY: number, upperZoneMaxY: number, lowerZoneMinY: number, lowerZoneMaxY: number;

      if (totalHeight < minHeight) {
        upperZoneMinY = areaTop;
        upperZoneMaxY = areaTop;
        lowerZoneMinY = areaTop + PIECE_H + GAP;
        lowerZoneMaxY = lowerZoneMinY;
      } else {
        const halfHeight = (totalHeight - GAP) / 2;
        upperZoneMinY = areaTop;
        upperZoneMaxY = areaTop + halfHeight - PIECE_H;
        lowerZoneMinY = areaTop + halfHeight + GAP;
        lowerZoneMaxY = areaBottom - PIECE_H;
      }

      const overlaps = (a: { x: number; y: number }, b: { x: number; y: number }) =>
        a.x < b.x + IMAGE_WIDTH && b.x < a.x + IMAGE_WIDTH && a.y < b.y + PIECE_H && b.y < a.y + PIECE_H;

      const swap = Math.random() < 0.5;
      const getPosInUpper = () => ({
        x: areaLeft + Math.random() * areaWidth,
        y: upperZoneMinY + Math.random() * Math.max(0, upperZoneMaxY - upperZoneMinY),
      });
      const getPosInLower = () => ({
        x: areaLeft + Math.random() * areaWidth,
        y: lowerZoneMinY + Math.random() * Math.max(0, lowerZoneMaxY - lowerZoneMinY),
      });

      let pos1 = swap ? getPosInLower() : getPosInUpper();
      let pos2 = swap ? getPosInUpper() : getPosInLower();

      // pos1과 pos2가 서로 겹치지 않는지 검증 후 재시도
      for (let i = 0; i < 50 && overlaps(pos1, pos2); i++) {
        pos1 = swap ? getPosInLower() : getPosInUpper();
        pos2 = swap ? getPosInUpper() : getPosInLower();
      }
      // 여전히 겹치면 상단/하단 고정 배치로 강제 (세로로 분리)
      if (overlaps(pos1, pos2)) {
        pos1 = { x: areaLeft, y: upperZoneMinY };
        pos2 = { x: areaLeft, y: lowerZoneMinY };
      }

      // avoidPiece와 겹치지 않도록 재시도 (되돌리기 시)
      if (avoidPiece && !avoidPiece.snapped) {
        for (let i = 0; i < 40; i++) {
          const p1 = swap ? getPosInLower() : getPosInUpper();
          const p2 = swap ? getPosInUpper() : getPosInLower();
          if (!overlaps(p1, p2) && !overlaps(p1, avoidPiece) && !overlaps(p2, avoidPiece)) {
            pos1 = p1;
            pos2 = p2;
            break;
          }
        }
      }

      return {
        top: { ...pos1, snapped: false },
        bottom: { ...pos2, snapped: false },
      };
    },
    [],
  );

  const initPieces = useCallback(() => {
    setPieces(getRandomPiecePositions());
  }, [getRandomPiecePositions]);

  useEffect(() => {
    if (!containerRef.current || initialized) return;
    initPieces();
    setInitialized(true);
  }, [initialized, initPieces]);

  const handlePointerDown = useCallback((piece: "top" | "bottom", e: React.PointerEvent) => {
    if (pieces[piece].snapped || completed) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    playPickupSound();
    setDragOffset({
      x: e.clientX - pieces[piece].x,
      y: e.clientY - pieces[piece].y,
    });
    setDragging(piece);
  }, [pieces, completed]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    setPieces(prev => ({
      ...prev,
      [dragging]: {
        ...prev[dragging],
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      },
    }));
  }, [dragging, dragOffset]);

  const handlePointerUp = useCallback(() => {
    if (!dragging) return;
    const target = getTargetPos();

    setPieces(prev => {
      const piece = prev[dragging];
      const targetY = dragging === "top" ? target.y : target.y + IMAGE_HEIGHT / 2;
      const dist = Math.hypot(piece.x - target.x, piece.y - targetY);

      if (dist < SNAP_THRESHOLD) {
        playSnapSound();
        const newPieces = {
          ...prev,
          [dragging]: { x: target.x, y: targetY, snapped: true },
        };
        const bothSnapped = dragging === "top"
          ? newPieces.top.snapped && prev.bottom.snapped
          : prev.top.snapped && newPieces.bottom.snapped;

        if (bothSnapped) {
          playSuccessSound();
          playCelebrationSound();
          setCompleted(true);
          setCelebrating(true);
          setTimeout(() => setShowNextStagePopup(true), 3000);
        }
        return newPieces;
      }

      // 맞추지 않고 놓았을 때, 왼쪽(실루엣) 영역이면 오른쪽으로 되돌리기 (겹치지 않게)
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const rightAreaX = rect.width * 0.5;
        if (piece.x < rightAreaX) {
          const other = dragging === "top" ? prev.bottom : prev.top;
          const newPositions = getRandomPiecePositions(other);
          return {
            ...prev,
            [dragging]: newPositions[dragging],
          };
        }
      }
      return prev;
    });
    setDragging(null);
  }, [dragging, getTargetPos, getRandomPiecePositions]);

  const handleNextStage = useCallback(() => {
    const nextIndex = stageIndex + 1;
    if (nextIndex >= CHARACTERS.length) {
      // 모든 스테이지 완료 - 처음으로
      setStageIndex(0);
    } else {
      setStageIndex(nextIndex);
    }
    setCompleted(false);
    setCelebrating(false);
    setShowNextStagePopup(false);
    setInitialized(false);
    setPieces({
      top: { x: 0, y: 0, snapped: false },
      bottom: { x: 0, y: 0, snapped: false },
    });
  }, [stageIndex]);

  const handleLongPressStart = useCallback((e: React.PointerEvent) => {
    longPressTimer.current = setTimeout(() => {
      setShowMenu(true);
    }, 800);
  }, []);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const target = getTargetPos();
  const isLastStage = stageIndex === CHARACTERS.length - 1;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-screen overflow-hidden select-none"
      style={{ background: "linear-gradient(135deg, #e0f7fa 0%, #b2ebf2 50%, #e8f5e9 100%)" }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* 왼쪽면/오른쪽면 구분선 */}
      <div
        className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 z-10"
        style={{ width: 8, background: "white", boxShadow: "0 0 10px rgba(255,255,255,0.9)" }}
      />

      {/* 스테이지 인디케이터 */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
        {CHARACTERS.map((_, i) => (
          <div
            key={i}
            className="w-3 h-3 rounded-full border-2 border-white"
            style={{
              background: i === stageIndex ? "#FF6B6B" : i < stageIndex ? "#4CAF50" : "rgba(255,255,255,0.5)",
              boxShadow: i === stageIndex ? "0 0 8px rgba(255,107,107,0.8)" : "none",
            }}
          />
        ))}
      </div>

      {/* 캐릭터 이름 */}
      <div className="absolute top-4 right-6 z-20 text-2xl font-bold text-white"
        style={{ textShadow: "2px 2px 4px rgba(0,0,0,0.3)" }}>
        {currentChar.name}
      </div>

      {/* 정답 실루엣 영역 */}
      <div
        className="absolute"
        style={{
          left: target.x,
          top: target.y,
          width: IMAGE_WIDTH,
          height: IMAGE_HEIGHT,
        }}
      >
        {/* 위쪽 실루엣 - 맞추면 컬러로 표시 */}
        <div style={{ position: "absolute", top: 0, left: 0, width: IMAGE_WIDTH, height: IMAGE_HEIGHT / 2, overflow: "hidden" }}>
          <img
            src={currentChar.img}
            style={{
              width: IMAGE_WIDTH,
              height: IMAGE_HEIGHT,
              display: "block",
              filter: pieces.top.snapped ? "none" : "brightness(0) opacity(0.18)",
              objectFit: "contain",
            }}
            draggable={false}
          />
          {/* 위쪽 조각 아웃라인 - 맞추지 않았을 때만 표시 */}
          {!pieces.top.snapped && (
            <img
              src={currentChar.img}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: IMAGE_WIDTH,
                height: IMAGE_HEIGHT,
                display: "block",
                pointerEvents: "none",
                filter:
                  "brightness(0) invert(1) drop-shadow(-1px -1px 0 white) drop-shadow(1px -1px 0 white) drop-shadow(-1px 1px 0 white) drop-shadow(1px 1px 0 white) drop-shadow(-1px 0 0 white) drop-shadow(1px 0 0 white) drop-shadow(0 -1px 0 white) drop-shadow(0 1px 0 white)",
                opacity: 0.6,
                objectFit: "contain",
              }}
              draggable={false}
            />
          )}
        </div>
        {/* 아래쪽 실루엣 - 맞추면 컬러로 표시 */}
        <div style={{ position: "absolute", top: IMAGE_HEIGHT / 2, left: 0, width: IMAGE_WIDTH, height: IMAGE_HEIGHT / 2, overflow: "hidden" }}>
          <img
            src={currentChar.img}
            style={{
              width: IMAGE_WIDTH,
              height: IMAGE_HEIGHT,
              display: "block",
              marginTop: -(IMAGE_HEIGHT / 2),
              filter: pieces.bottom.snapped ? "none" : "brightness(0) opacity(0.18)",
              objectFit: "contain",
            }}
            draggable={false}
          />
          {/* 아래쪽 조각 아웃라인 - 맞추지 않았을 때만 표시 */}
          {!pieces.bottom.snapped && (
            <img
              src={currentChar.img}
              style={{
                position: "absolute",
                top: -(IMAGE_HEIGHT / 2),
                left: 0,
                width: IMAGE_WIDTH,
                height: IMAGE_HEIGHT,
                display: "block",
                pointerEvents: "none",
                filter:
                  "brightness(0) invert(1) drop-shadow(-1px -1px 0 white) drop-shadow(1px -1px 0 white) drop-shadow(-1px 1px 0 white) drop-shadow(1px 1px 0 white) drop-shadow(-1px 0 0 white) drop-shadow(1px 0 0 white) drop-shadow(0 -1px 0 white) drop-shadow(0 1px 0 white)",
                opacity: 0.6,
                objectFit: "contain",
              }}
              draggable={false}
            />
          )}
        </div>

        {/* 구분선 - 캐릭터 외곽선 모양으로 흰색 굵은 선 */}
        <div style={{ position: "absolute", top: IMAGE_HEIGHT / 2 - 4, left: 0, width: IMAGE_WIDTH, height: 8, overflow: "hidden", zIndex: 5 }}>
          {/* 위쪽 반 - 아래 경계 */}
          <div style={{ position: "relative", width: IMAGE_WIDTH, height: IMAGE_HEIGHT / 2, overflow: "hidden", marginTop: -(IMAGE_HEIGHT / 2 - 4) }}>
            <img
              src={currentChar.img}
              style={{
                width: IMAGE_WIDTH,
                height: IMAGE_HEIGHT,
                display: "block",
                filter: "brightness(0) invert(1) opacity(0.9) drop-shadow(0 0 4px white)",
                objectFit: "contain",
              }}
              draggable={false}
            />
          </div>
        </div>
      </div>

      {/* 위 조각 */}
      {!pieces.top.snapped && (
        <div
          className="absolute cursor-grab active:cursor-grabbing"
          style={{
            left: pieces.top.x,
            top: pieces.top.y,
            width: IMAGE_WIDTH,
            height: IMAGE_HEIGHT / 2,
            overflow: "hidden",
            touchAction: "none",
            zIndex: dragging === "top" ? 10 : 5,
            filter: dragging === "top" ? "drop-shadow(0 4px 12px rgba(255,255,255,0.9)) drop-shadow(0 8px 28px rgba(255,255,255,0.7))" : undefined,
            animation: dragging === "top"
              ? undefined
              : "piece-float 14s ease-in-out infinite, piece-sparkle 2.5s ease-in-out infinite",
            animationDelay: dragging === "top" ? undefined : "0s, 0.3s",
          }}
          onPointerDown={(e) => handlePointerDown("top", e)}
        >
          <img
            src={currentChar.img}
            style={{
              width: IMAGE_WIDTH,
              height: IMAGE_HEIGHT,
              display: "block",
              objectFit: "contain",
            }}
            draggable={false}
          />
        </div>
      )}

      {/* 아래 조각 */}
      {!pieces.bottom.snapped && (
        <div
          className="absolute cursor-grab active:cursor-grabbing"
          style={{
            left: pieces.bottom.x,
            top: pieces.bottom.y,
            width: IMAGE_WIDTH,
            height: IMAGE_HEIGHT / 2,
            overflow: "hidden",
            touchAction: "none",
            zIndex: dragging === "bottom" ? 10 : 5,
            filter: dragging === "bottom" ? "drop-shadow(0 4px 12px rgba(255,255,255,0.9)) drop-shadow(0 8px 28px rgba(255,255,255,0.7))" : undefined,
            animation: dragging === "bottom"
              ? undefined
              : "piece-float 14s ease-in-out infinite, piece-sparkle 2.5s ease-in-out infinite",
            animationDelay: dragging === "bottom" ? undefined : "7s, 0.8s",
          }}
          onPointerDown={(e) => handlePointerDown("bottom", e)}
        >
          <img
            src={currentChar.img}
            style={{
              width: IMAGE_WIDTH,
              height: IMAGE_HEIGHT,
              display: "block",
              marginTop: -(IMAGE_HEIGHT / 2),
              objectFit: "contain",
            }}
            draggable={false}
          />
        </div>
      )}

      {/* 완성된 전체 이미지 */}
      {completed && (
        <div
          className="absolute"
          style={{
            left: target.x,
            top: target.y,
            width: IMAGE_WIDTH,
            height: IMAGE_HEIGHT,
            zIndex: 8,
          }}
        >
          <img
            src={currentChar.img}
            style={{ width: IMAGE_WIDTH, height: IMAGE_HEIGHT, display: "block", objectFit: "contain" }}
            draggable={false}
          />
        </div>
      )}

      {/* 맞추자마자 "완성!" 텍스트 (음영 없음) */}
      {completed && !showNextStagePopup && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
          style={{ zIndex: 25, paddingTop: "20%" }}
        >
          <div className="text-4xl font-bold text-center" style={{ color: "#FF6B6B", textShadow: "2px 2px 4px rgba(255,255,255,0.9)" }}>
            🎉 완성!
          </div>
          <div className="text-2xl font-semibold text-center mt-2" style={{ color: "#333", textShadow: "1px 1px 2px rgba(255,255,255,0.8)" }}>
            {currentChar.name} 완성!
          </div>
        </div>
      )}

      {/* 2초 후 "다음 단계로" 팝업 (전체화면 음영) */}
      {showNextStagePopup && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center z-30"
          style={{ background: "rgba(0,0,0,0.35)" }}
        >
          <div
            className="bg-white rounded-3xl px-10 py-8 flex flex-col items-center gap-4"
            style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.25)" }}
          >
            <div className="text-4xl font-bold text-center" style={{ color: "#FF6B6B" }}>
              🎉 완성!
            </div>
            <div className="text-2xl font-semibold text-center" style={{ color: "#333" }}>
              {currentChar.name} 완성!
            </div>
            <button
              onClick={handleNextStage}
              className="mt-2 px-8 py-4 rounded-2xl text-white text-2xl font-bold"
              style={{
                background: isLastStage
                  ? "linear-gradient(135deg, #4CAF50, #2E7D32)"
                  : "linear-gradient(135deg, #FF6B6B, #FF8E53)",
                boxShadow: "0 4px 16px rgba(255,107,107,0.5)",
                border: "none",
                cursor: "pointer",
              }}
            >
              {isLastStage ? "🏆 처음부터 다시!" : "다음 단계로 ➡️"}
            </button>
          </div>
        </div>
      )}

      {/* 롱프레스 메뉴 */}
      <div
        className="absolute inset-0 z-0"
        onPointerDown={handleLongPressStart}
        onPointerUp={handleLongPressEnd}
        onPointerLeave={handleLongPressEnd}
        style={{ pointerEvents: "none" }}
      />

      {showMenu && (
        <div
          className="absolute inset-0 flex items-center justify-center z-40"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => setShowMenu(false)}
        >
          <div className="bg-white rounded-2xl p-6 flex flex-col gap-3 min-w-[200px]">
            <button
              className="text-lg font-semibold py-2 px-4 rounded-xl"
              style={{ background: "#f0f0f0" }}
              onClick={() => {
                setCompleted(false);
                setCelebrating(false);
                setShowNextStagePopup(false);
                setInitialized(false);
                setPieces({ top: { x: 0, y: 0, snapped: false }, bottom: { x: 0, y: 0, snapped: false } });
                setShowMenu(false);
              }}
            >
              🔄 다시 시작
            </button>
          </div>
        </div>
      )}

      {celebrating && (
        <Celebration onComplete={() => setCelebrating(false)} />
      )}
    </div>
  );
}
