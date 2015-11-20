'use strict'

function enableDrag(container, context, draggableSelector, dragStart) {
  var $window = $(window);
  var parent = context.parent();
  var dragState = {};
  var dragStop = null;

  // watch mouse move events on the container to move anything being dragged
  container.on('mousemove', function(event) {
    var cx = event.clientX;
    var cy = event.clientY;
    var lastx = dragState.lastx;
    var lasty = dragState.lasty;
    dragState.lastx = cx;
    dragState.lasty = cy;

    // dragging a node
    if (dragState.target) {
      if (!dragState.isDragging) {
        // just started the drag
        dragState.isDragging = true;
        dragStop = dragStart(dragState);

        // cache positions that won't change while dragging
        dragState.scrollX = parent.scrollLeft() + $window.scrollLeft() - parent.offset().left - dragState.offsetX;
        dragState.scrollY = parent.scrollTop() + $window.scrollTop() - parent.offset().top - dragState.offsetY;
      }

      requestAnimationFrame(function() {
        dragState.target && dragState.target.css({
          left: cx + dragState.scrollX,
          top: cy + dragState.scrollY
        });
      });
    } else if (dragState.panning) {
      requestAnimationFrame(function() {
        parent.scrollLeft(parent.scrollLeft() + lastx - cx);
        parent.scrollTop(parent.scrollTop() + lasty - cy);
      });
    }
  });

  container.on('mousedown', draggableSelector, function(event) {
    // mark the node as being dragged using event-delegation
    dragState.target = $(this);
    dragState.panning = false;

    // store offset of event so node moves properly
    dragState.offsetX = event.offsetX;
    dragState.offsetY = event.offsetY;

    event.stopPropagation();
    event.preventDefault();
  });

  container.on('mousedown', function(event) {
    dragState.target = null;
    dragState.panning = true;
    event.stopPropagation();
    event.preventDefault();
  });

  function cancelDrag() {
    if (dragStop) dragStop();
    dragStop = null;
    dragState.isDragging = false;
    dragState.target = null;
    dragState.panning = false;
  }

  container.on('mouseup', cancelDrag);

  $(document).on('keydown', function(event) {
    // esc key
    if (event.keyCode === 27) {
      cancelDrag();
    }
  });
}

module.exports = enableDrag;
