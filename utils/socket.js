
let socket_io;


exports.setIo = function(io){
    socket_io = io;
}

exports.emit = function(msg, data){
    socket_io.emit(msg, data);
}

