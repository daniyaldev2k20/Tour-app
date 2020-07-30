const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const APIFeatures = require('../utils/api-features');

//Factory Function for all models not just for one specific model like Tour
//Takes Model as an input and returns catchAsync meaning getting access to req.params
exports.deleteOne = (Model) =>
  catchAsync(async (req, res, next) => {
    const doc = await Model.findByIdAndDelete(req.params.id);

    //return is used because if tour is null, then function must exit
    if (!doc) {
      return next(new AppError('No document found with that ID', 404));
    }

    res.status(204).json({
      status: 'success',
      data: null,
    });
  });

exports.updateOne = (Model) =>
  catchAsync(async (req, res, next) => {
    //findByIdAndUpdate only updates data that is not password, because running this function
    //all the save middleware is not run, meaning passwordConfirm will not get validated
    const doc = await Model.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true, //run all data validation in tour schema, currently set to true
    });

    //return is used because if tour is null, then function must exit
    if (!doc) {
      return next(new AppError('No document found with that ID', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        doc,
      },
    });
  });

exports.createOne = (Model) =>
  catchAsync(async (req, res, next) => {
    const doc = await Model.create(req.body);

    res.status(201).json({
      status: 'success',
      data: {
        doc,
      },
    });
  });

exports.getOne = (Model, populateOptions) =>
  catchAsync(async (req, res, next) => {
    //query checks whether populateOptions has been passed in or not, if passed in then
    //populate function is attached to query else not
    let query = Model.findById(req.params.id);
    if (populateOptions) {
      query = query.populate(populateOptions);
    }
    const doc = await query;

    //return is used because if doc is null, then function must exit
    if (!doc) {
      return next(new AppError('No document found with that ID', 404));
    }
    res.status(200).json({
      status: 'success',
      data: {
        doc,
      },
    });
  });

exports.getAll = (Model, filterOption = false) =>
  catchAsync(async (req, res, next) => {
    //Condition for setting filter in case of getAllReviews in ReviewController
    let filter = {};
    if (req.params.tourId) {
      //if tourId is present, then filter object will be passed to Tour.find() due to mongo and object spec and only the reviews will be found, where tour matches the id
      //regular API call without the nested route will return empty object which will find all the reviews
      filter = { tour: req.params.tourId };
    }

    //EXECUTE QUERY
    let features = {};
    let doc = {};

    if (filterOption) {
      features = new APIFeatures(Model.find(filter), req.query)
        .filter()
        .sort()
        .limitFields()
        .paginate();
      doc = await features.query;
    } else {
      features = new APIFeatures(Model.find(), req.query)
        .filter()
        .sort()
        .limitFields()
        .paginate();
      doc = await features.query;
      // doc = await features.query.explain(); //explain shows the execution stats, useful for indexing
    }

    //SEND RESPONSE
    res.status(200).json({
      status: 'success',
      results: doc.length,
      data: {
        doc,
      },
    });
  });

//MongoDB find method i.e Tour.findOne({ _id:req.params.id}) similar to findById(req.params.id)

// this populate only populates reviews on single tour, that is why reviews are not visible
// on getAllTours function or route
// const doc = await Model.findById(req.params.id).populate('reviews');
