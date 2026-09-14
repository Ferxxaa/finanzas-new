$(function(){
    function pageLoad(){
        var calendarApiBase = (window.NBI_API_URL || 'http://trazas-nbi.com:1234/api/').replace(/\/$/, '');
        var $calendarElement = $('#calendar');
        var $calendar;

        if (!$calendarElement.length || typeof $.fn.fullCalendar !== 'function') {
            return;
        }

        if (typeof $.fn.draggable === 'function') {
            $('#external-events').find('div.external-event').each(function() {

            // create an Event Object (http://arshaw.com/fullcalendar/docs/event_data/Event_Object/)
            // it doesn't need to have a start or end
            var eventObject = {
                title: $.trim($(this).text()) // use the element's text as the event title
            };

            // store the Event Object in the DOM element so we can get to it later
            $(this).data('eventObject', eventObject);

            // make the event draggable using jQuery UI
            $(this).draggable({
                zIndex: 999,
                revert: true,      // will cause the event to go back to its
                revertDuration: 0  //  original position after the drag
            });

            });
        }

        if ($calendarElement.data('fullCalendar')) {
            $calendarElement.fullCalendar('destroy');
        }

        $.get( calendarApiBase + "/Calendario/", function( data ){
            //console.log(data);

            $calendar = $calendarElement.fullCalendar({
                header: {
                    left: '',
                    center: '',
                    right: ''
                },

                selectable: true,
                selectHelper: true,
                select: function(start, end, allDay) {
                    var url = calendarApiBase + "/Calendario/GetCalendarioDiario/Fecha="+start.getFullYear()+"-"+(start.getMonth()+1)+"-"+start.getDate();
                    console.log(url);
                    $.get( url, function( dataDia ){
                        var widget = $("#widget");
                        var widgetbody, h5, row, label, br;
                        var items = dataDia || [];
                        
                        console.log(items);

                        widget.empty();

                        for (var i = 0; i < items.length; i++) {
                            widgetbody = document.createElement("div");

                            widgetbody.setAttribute("class","widget-body");
                            widgetbody.setAttribute("style","padding: 1rem;border-radius: 8px;background-color:"+items[i].backgroundColor);

                            h5 = document.createElement("h5");
                            h5.innerHTML="Detalle Licitación";
                            h5.setAttribute("style","font-weight: bold;");
                            widgetbody.appendChild(h5);

                            //Licitación
                            row = document.createElement("div");
                            row.setAttribute("class","row");
                            label = document.createElement("label");
                            label.setAttribute("class","col-md-2 form-control-label");
                            label.setAttribute("style","font-weight: bold;");
                            label.innerHTML="Licitacion:";
                            row.appendChild(label);
                            label = document.createElement("label");
                            label.setAttribute("class","col-md-8 form-control-label");
                            label.innerHTML = items[i].Descripcion;
                            row.appendChild(label);
                            widgetbody.appendChild(row);

                            //Hito
                            row = document.createElement("div");
                            row.setAttribute("class","row");
                            label = document.createElement("label");
                            label.setAttribute("class","col-md-2 form-control-label");
                            label.setAttribute("style","font-weight: bold;");
                            label.innerHTML="Hito:";
                            row.appendChild(label);
                            label = document.createElement("label");
                            label.setAttribute("class","col-md-8 form-control-label");
                            label.innerHTML = items[i].NombreHito;
                            row.appendChild(label);
                            widgetbody.appendChild(row);

                            //Mandante
                            row = document.createElement("div");
                            row.setAttribute("class","row");
                            label = document.createElement("label");
                            label.setAttribute("class","col-md-2 form-control-label");
                            label.setAttribute("style","font-weight: bold;");
                            label.innerHTML="Mandante:";
                            row.appendChild(label);
                            label = document.createElement("label");
                            label.setAttribute("class","col-md-8 form-control-label");
                            label.innerHTML = items[i].NombreMandante;
                            row.appendChild(label);
                            widgetbody.appendChild(row);

                            //Ejecutivo
                            row = document.createElement("div");
                            row.setAttribute("class","row");
                            label = document.createElement("label");
                            label.setAttribute("class","col-md-2 form-control-label");
                            label.setAttribute("style","font-weight: bold;");
                            label.innerHTML="Ejecutivo:";
                            row.appendChild(label);
                            label = document.createElement("label");
                            label.setAttribute("class","col-md-8 form-control-label");
                            label.innerHTML = items[i].NombreEjecutivo;
                            row.appendChild(label);
                            widgetbody.appendChild(row);

                            //Agrega la tarea completa
                            widget.append(widgetbody);

                            //Salto de linea
                            br = document.createElement("br");
                            widget.append(br);
                        }

                    }).fail(function() {
                        console.warn('Calendar daily data is unavailable for the current environment.');
                    });
                },
                editable: true,
                droppable:true,

                drop: function(date, allDay) { // this function is called when something is dropped

                    // retrieve the dropped element's stored Event Object
                    var originalEventObject = $(this).data('eventObject');

                    // we need to copy it, so that multiple events don't have a reference to the same object
                    var copiedEventObject = $.extend({}, originalEventObject);

                    // assign it the date that was reported
                    copiedEventObject.start = date;
                    copiedEventObject.allDay = allDay;

                    var $categoryClass = $(this).data('event-class');
                    if ($categoryClass)
                        copiedEventObject['className'] = [$categoryClass];

                    // render the event on the calendar
                    // the last `true` argument determines if the event "sticks" (http://arshaw.com/fullcalendar/docs/event_rendering/renderEvent/)
                    $calendarElement.fullCalendar('renderEvent', copiedEventObject, true);

                    $(this).remove();

                },

                // US Holidays
                events: data,

                eventClick: function(event) {
                    // opens events in a popup window
                    if (event.url){
                        window.open(event.url, 'gcalevent', 'width=700,height=600');
                        return false
                    } else {
                        var $modal = $("#myModal"),
                            $modalLabel = $("#myModalLabel");
                        $modalLabel.html(event.title);
                        $modal.find(".modal-body p").html(function(){
                            if (event.allDay){
                                return "All day event"
                            } else {
                                return "Start At: <strong>" + event.start.getHours() + ":" + (event.start.getMinutes() == 0 ? "00" : event.start.getMinutes()) + "</strong></br>"
                                    + (event.end == null ? "" : "End At: <strong>" + event.end.getHours() + ":" + (event.end.getMinutes() == 0 ? "00" : event.end.getMinutes()) + "</strong>")
                            }
                        }());
                        $modal.modal('show');
                    }
                }

            });

            function updateCalendarHeader() {
                var currentDate = $calendar.fullCalendar('getDate');

                $('#calender-current-date').html(
                    $.fullCalendar.formatDate(currentDate, "MMM yyyy") +
                    " - <span class='fw-semi-bold'>" +
                    $.fullCalendar.formatDate(currentDate, "dddd") +
                    "</span>"
                );
            }

            $("#calendar-switcher").find("label").off('click.calendarView').on('click.calendarView', function(){
                $calendar.fullCalendar('changeView', $(this).find('input').val());
            });

            updateCalendarHeader();

            $('#calender-prev').off('click.calendarNav').on('click.calendarNav', function(){
                $calendar.fullCalendar('prev');
                updateCalendarHeader();
            });

            $('#calender-next').off('click.calendarNav').on('click.calendarNav', function(){
                $calendar.fullCalendar('next');
                updateCalendarHeader();
            });
        }).fail(function() {
            console.warn('Calendar data is unavailable for the current environment.');
        });
    }
    pageLoad();
    if (window.SingApp && typeof SingApp.onPageLoad === 'function') {
        SingApp.onPageLoad(pageLoad);
    }
});
