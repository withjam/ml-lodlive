'use strict'

function enableDrag(container, context, draggableSelector, dragStart) {
  var $window = $(window);
  var dragState = {};
  var dragStop = null;

  // watch mouse move events on the container to move anything being dragged
  container.on('mousemove', function(event) {
    var cx = event.clientX;
    var cy = event.clientY;
    var scrx = context.parent().scrollLeft();
    var scry = context.parent().scrollTop();
    var lastx = dragState.lastx;
    var lasty = dragState.lasty;
    var diffx = lastx - cx;
    var diffy = lasty - cy;

    dragState.lastx = cx;
    dragState.lasty = cy;

    // dragging a node
    if (dragState.target) {
      if (!dragState.isDragging) {
        // just started the drag
        dragState.isDragging = true;
        dragStop = dragStart(dragState);
      }

      dragState.target.css({
        left: cx + scrx - dragState.offsetX + $window.scrollLeft() - context.parent().offset().left,
        top: cy + scry - dragState.offsetY + $window.scrollTop() - context.parent().offset().top
      });
    } else if (dragState.panning) {
      context.parent().scrollLeft(scrx + diffx);
      context.parent().scrollTop(scry + diffy);
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
