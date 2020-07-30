//app.js is used only for configuration of application wrt Express
const path = require('path');
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const bookingRouter = require('./routes/bookingRoutes');
const viewRouter = require('./routes/viewRoutes');

const app = express();

//setting template engine to pug; views are View in MVC architecture
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

//1) GLOBAL MIDDLEWARES
//in app.use we always need a function, not a function call

// Serving static files
//path.join ensures that no error occurs due to / occurs or not, Node.js will automatically create a path
app.use(express.static(path.join(__dirname, 'public')));

//Set security HTTP headers
app.use(helmet());

//Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

//this limits the requests by an IP address to the server
//limiter is a middleware function
const limiter = rateLimit({
  max: 100, //max number of requests
  windowMs: 60 * 60 * 1000, //window period for requests
  message: 'Too many requests from this IP, please try again in an hour',
});
//limiter is applied to routes starting with URL /api
app.use('/api', limiter);

// Body parser, reading data from body into req.body
//limits body to 10kb
app.use(
  express.json({
    limit: '10kb',
  })
);
app.use(cookieParser()); //this parses the data from cookies, req.cookies

// Data sanitization against NoSQL query injection
//mongoSanitize is a function we will call, which will return a middleware function used by app
//mongoSanitize filters out $ and . from req.body, req.query and req.params
app.use(mongoSanitize());

// Data sanitization against XSS Cross site scripting attack
//clean user input from html code, converts html symbol into entities
app.use(xss());

//Prevent parameter pollution, no duplicate params like sort=price&sort=rating, only gets last
app.use(
  hpp({
    //whitelist allows duplicate params
    whitelist: [
      'duration',
      'ratingsQuantity',
      'ratingsAverage',
      'maxGroupSize',
      'difficulty',
      'price',
    ],
  })
);

// Test Middleware
app.use((req, res, next) => {
  console.log('Hello from the middleware');
  next();
});

app.use((req, res, next) => {
  // console.log(req.cookies);
  req.requestTime = new Date().toISOString();
  next();
});

// 3) ROUTES
// Routers specified after URL '/api/v1/' are middlewares mounted upon their respective paths
app.use('/', viewRouter); // URL is root of website
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/bookings', bookingRouter);

//Route for all * (get, post, etc) and this middleware runs when the previous routes do
//not return anything; handling bad routes
app.all('*', (req, res, next) => {
  //if next receives an argument, Express will automatically know that it is an error
  //object and will skip other middleware and send the error obj to global error handling middleware
  next(new AppError(`Can't find ${req.originalUrl} on this server`, 404));
});

//Error handling middleware
app.use(globalErrorHandler);
module.exports = app;
